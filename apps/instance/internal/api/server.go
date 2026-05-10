// Package api wires the instance HTTP routes:
//
//	GET  /health   — unauthenticated liveness probe + tooling versions.
//	POST /info     — HMAC-protected; runs yt-dlp metadata for a URL.
//	POST /stream   — HMAC-protected; pipes yt-dlp → ffmpeg fMP4 → response.
//
// All handler bodies are JSON. Cookies arrive as a JSON array on the body and
// are written to a 0600 temp Netscape file for the duration of the handler.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"
	"sync/atomic"
	"time"

	"github.com/e2kmovie-max/Wave/apps/instance/internal/auth"
	"github.com/e2kmovie-max/Wave/apps/instance/internal/cookies"
	"github.com/e2kmovie-max/Wave/apps/instance/internal/streamer"
	"github.com/e2kmovie-max/Wave/apps/instance/internal/version"
)

// Config is the runtime configuration for the HTTP server.
type Config struct {
	Verifier      *auth.Verifier
	YTDLPBinary   string
	FFmpegBinary  string
	StartedAt     time.Time
	MaxStreams    int32 // 0 ⇒ no cap
}

// Server is an http.Handler that owns the instance state.
type Server struct {
	cfg     Config
	mux     *http.ServeMux
	active  atomic.Int32
	infoVer atomic.Pointer[toolVersions]
}

type toolVersions struct {
	YTDLP  string `json:"ytDlp"`
	FFmpeg string `json:"ffmpeg"`
}

// New constructs the HTTP handler.
func New(cfg Config) *Server {
	if cfg.YTDLPBinary == "" {
		cfg.YTDLPBinary = "yt-dlp"
	}
	if cfg.FFmpegBinary == "" {
		cfg.FFmpegBinary = "ffmpeg"
	}
	if cfg.StartedAt.IsZero() {
		cfg.StartedAt = time.Now().UTC()
	}
	s := &Server{cfg: cfg, mux: http.NewServeMux()}
	s.routes()
	s.refreshToolVersions()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", s.handleHealth)
	if s.cfg.Verifier == nil {
		// Without a verifier we still register the routes but reject everything;
		// this is only meant for unit tests.
		s.mux.HandleFunc("POST /info", reject)
		s.mux.HandleFunc("POST /stream", reject)
		return
	}
	s.mux.Handle("POST /info", s.cfg.Verifier.Middleware(http.HandlerFunc(s.handleInfo)))
	s.mux.Handle("POST /stream", s.cfg.Verifier.Middleware(http.HandlerFunc(s.handleStream)))
}

func reject(w http.ResponseWriter, _ *http.Request) {
	http.Error(w, "instance secret not configured", http.StatusServiceUnavailable)
}

// handleHealth is unauthenticated by design — the master pings it without
// signing because the response carries no cookies and no per-room data.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	versions := s.infoVer.Load()
	if versions == nil {
		versions = &toolVersions{}
	}
	resp := map[string]any{
		"ok":            true,
		"version":       version.Version,
		"startedAt":     s.cfg.StartedAt.Format(time.RFC3339),
		"uptimeSeconds": int64(time.Since(s.cfg.StartedAt).Seconds()),
		"activeStreams": s.active.Load(),
		"maxStreams":    s.cfg.MaxStreams,
		"tools":         versions,
	}
	writeJSON(w, http.StatusOK, resp)
}

type infoRequest struct {
	URL       string            `json:"url"`
	UserAgent string            `json:"userAgent,omitempty"`
	Cookies   []cookies.Cookie  `json:"cookies,omitempty"`
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	var req infoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}

	cookieFile, err := cookies.Write(req.Cookies)
	if err != nil {
		http.Error(w, "write cookies: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer cookieFile.Remove()

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	info, err := streamer.FetchInfo(ctx, streamer.InfoOptions{
		URL:         req.URL,
		CookiesFile: cookieFilePath(cookieFile),
		UserAgent:   req.UserAgent,
		YTDLPBinary: s.cfg.YTDLPBinary,
	})
	if err != nil {
		// Surface yt-dlp errors as 502 so the master knows it's an upstream
		// problem (e.g. video unavailable, age-restricted, geo-blocked).
		http.Error(w, "yt-dlp: "+err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

type streamRequest struct {
	URL       string            `json:"url"`
	FormatID  string            `json:"formatId,omitempty"`
	UserAgent string            `json:"userAgent,omitempty"`
	Cookies   []cookies.Cookie  `json:"cookies,omitempty"`
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	if max := s.cfg.MaxStreams; max > 0 && s.active.Load() >= max {
		http.Error(w, "instance is at max streams", http.StatusServiceUnavailable)
		return
	}

	var req streamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}

	cookieFile, err := cookies.Write(req.Cookies)
	if err != nil {
		http.Error(w, "write cookies: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer cookieFile.Remove()

	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "no-store")
	// We do not set Content-Length: the remux is streaming and we don't know
	// the total size until we're done.

	s.active.Add(1)
	defer s.active.Add(-1)

	flusher, _ := w.(http.Flusher)
	dst := &flushingWriter{w: w, flusher: flusher}

	if err := streamer.Pipeline(r.Context(), dst, streamer.StreamOptions{
		URL:          req.URL,
		FormatID:     req.FormatID,
		CookiesFile:  cookieFilePath(cookieFile),
		UserAgent:    req.UserAgent,
		YTDLPBinary:  s.cfg.YTDLPBinary,
		FFmpegBinary: s.cfg.FFmpegBinary,
	}); err != nil {
		// At this point we've already begun streaming bytes; we can't change
		// the status code, so just log and let the caller see the truncation.
		// (Log is added by the http.Server's ErrorLog elsewhere.)
		_ = err
	}
}

func cookieFilePath(f *cookies.File) string {
	if f == nil {
		return ""
	}
	return f.Path
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// flushingWriter forces a flush after every Write so HTTP clients receive the
// fragmented MP4 progressively.
type flushingWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func (fw *flushingWriter) Write(p []byte) (int, error) {
	n, err := fw.w.Write(p)
	if fw.flusher != nil && n > 0 {
		fw.flusher.Flush()
	}
	return n, err
}

// refreshToolVersions probes yt-dlp and ffmpeg once at startup and stores the
// strings for /health to report.
func (s *Server) refreshToolVersions() {
	v := &toolVersions{}
	if out, err := exec.Command(s.cfg.YTDLPBinary, "--version").Output(); err == nil {
		v.YTDLP = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command(s.cfg.FFmpegBinary, "-version").Output(); err == nil {
		// "ffmpeg version N.N.N Copyright …" – take the first line.
		first, _, _ := strings.Cut(string(out), "\n")
		v.FFmpeg = strings.TrimSpace(first)
	}
	s.infoVer.Store(v)
}
