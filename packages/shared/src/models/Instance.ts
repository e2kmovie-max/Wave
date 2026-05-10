import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A Go streaming instance (yt-dlp + ffmpeg) that lives at a known URL on :8080
 * (or behind a domain with HTTPS). Cookies are NEVER stored on the instance —
 * they are passed in the body of stream/info requests by the master node.
 */
const instanceSchema = new Schema(
  {
    name: { type: String, required: true },

    /**
     * Base URL of the instance. Examples:
     *  - http://203.0.113.42:8080      (raw IP, no domain)
     *  - https://stream-1.example.com  (with domain + HTTPS)
     *  - http://localhost:8080         (the bundled local instance)
     */
    url: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v: string) => /^https?:\/\/.+/.test(v),
        message: "Instance URL must start with http:// or https://",
      },
    },

    isLocal: { type: Boolean, default: false },

    /** Shared HMAC secret used to authenticate master→instance requests. */
    secret: { type: String, required: true },

    isHealthy: { type: Boolean, default: false },
    lastHealthAt: { type: Date },
    lastHealthError: { type: String },

    /** Number of currently active stream sessions on this instance. */
    activeStreams: { type: Number, default: 0 },

    /** Optional cap on parallel streams; 0 = no limit. */
    maxStreams: { type: Number, default: 0 },

    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

instanceSchema.virtual("isInsecure").get(function (this: { url: string }) {
  return this.url.startsWith("http://");
});

export type InstanceDoc = InferSchemaType<typeof instanceSchema>;
export type InstanceModel = Model<InstanceDoc>;

export const Instance: InstanceModel =
  (models.Instance as InstanceModel) ?? model<InstanceDoc>("Instance", instanceSchema);
