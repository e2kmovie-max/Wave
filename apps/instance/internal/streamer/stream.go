package streamer

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os/exec"
)

// StreamOptions describes a single streaming request.
type StreamOptions struct {
	URL         string
	FormatID    string // optional; "" lets yt-dlp pick best
	CookiesFile string // optional Netscape file path
	UserAgent   string
	YTDLPBinary string // defaults to "yt-dlp"
	FFmpegBinary string // defaults to "ffmpeg"
}

// Pipeline runs yt-dlp piped through ffmpeg, remuxing the stream to fragmented
// MP4 (suitable for streaming over HTTP without seek). Output is written to
// dst as it becomes available.
//
// The function blocks until either: ffmpeg finishes (in which case the
// underlying yt-dlp may still be wrapping up — it will be cleaned up on
// context cancel), the context is cancelled, or any of the processes errors.
//
// Layout:
//
//	yt-dlp --cookies <file> -o - -f <fmt> -- <url>  ──>  ffmpeg -i pipe: ... pipe:1  ──>  dst
func Pipeline(ctx context.Context, dst io.Writer, opts StreamOptions) error {
	if dst == nil {
		return errors.New("nil writer")
	}
	if _, err := url.ParseRequestURI(opts.URL); err != nil {
		return fmt.Errorf("invalid url: %w", err)
	}

	ytdlpBin := opts.YTDLPBinary
	if ytdlpBin == "" {
		ytdlpBin = "yt-dlp"
	}
	ffmpegBin := opts.FFmpegBinary
	if ffmpegBin == "" {
		ffmpegBin = "ffmpeg"
	}

	ytArgs := []string{
		"-o", "-",
		"--no-warnings",
		"--no-playlist",
		"--no-progress",
		"--quiet",
	}
	if opts.FormatID != "" {
		ytArgs = append(ytArgs, "-f", opts.FormatID)
	}
	if opts.CookiesFile != "" {
		ytArgs = append(ytArgs, "--cookies", opts.CookiesFile)
	}
	if opts.UserAgent != "" {
		ytArgs = append(ytArgs, "--user-agent", opts.UserAgent)
	}
	ytArgs = append(ytArgs, "--", opts.URL)

	ytCmd := exec.CommandContext(ctx, ytdlpBin, ytArgs...) //nolint:gosec
	ytStdout, err := ytCmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("ytdlp stdout pipe: %w", err)
	}
	ytCmd.Stderr = io.Discard

	ffArgs := []string{
		"-hide_banner",
		"-loglevel", "error",
		"-i", "pipe:0",
		"-c", "copy",
		"-f", "mp4",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"pipe:1",
	}
	ffCmd := exec.CommandContext(ctx, ffmpegBin, ffArgs...) //nolint:gosec
	ffCmd.Stdin = ytStdout
	ffCmd.Stdout = dst
	ffCmd.Stderr = io.Discard

	if err := ytCmd.Start(); err != nil {
		return fmt.Errorf("start yt-dlp: %w", err)
	}
	if err := ffCmd.Start(); err != nil {
		_ = ytCmd.Process.Kill()
		_, _ = ytCmd.Process.Wait()
		return fmt.Errorf("start ffmpeg: %w", err)
	}

	ffErr := ffCmd.Wait()
	// ffmpeg has finished (success or context cancel); make sure yt-dlp is gone.
	if ytCmd.ProcessState == nil {
		_ = ytCmd.Process.Kill()
	}
	ytErr := ytCmd.Wait()

	if ctx.Err() != nil {
		return ctx.Err()
	}
	if ffErr != nil {
		return fmt.Errorf("ffmpeg: %w", ffErr)
	}
	if ytErr != nil && !isExpectedExit(ytErr) {
		return fmt.Errorf("yt-dlp: %w", ytErr)
	}
	return nil
}

func isExpectedExit(err error) bool {
	var ee *exec.ExitError
	if !errors.As(err, &ee) {
		return false
	}
	// yt-dlp exits non-zero when its stdout pipe is closed early (which
	// happens whenever ffmpeg finishes first or the client disconnects).
	// Treat -1 (signaled), 1 (broken pipe), 141 (SIGPIPE) as expected.
	code := ee.ExitCode()
	return code == -1 || code == 1 || code == 141
}
