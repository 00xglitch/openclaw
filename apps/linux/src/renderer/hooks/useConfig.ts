import { useState, useCallback, useEffect, useRef } from "react";
import type { ConfigSnapshot } from "../lib/protocol-types.js";

export function useConfig(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [rawOriginal, setRawOriginal] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  const requestRef = useRef(request);
  requestRef.current = request;
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestRef.current<ConfigSnapshot>("config.get", {});
      setRaw(res.raw);
      setRawOriginal(res.raw);
      setHash(res.hash);
      setValid(res.valid);
      setIssues(res.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
    if (!enabled) {loadedRef.current = false;}
  }, [enabled, load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await requestRef.current("config.set", { raw, baseHash: hash });
      setSuccess("Config saved");
      // Reload to get new hash
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [raw, hash, load]);

  const apply = useCallback(async () => {
    setApplying(true);
    setError(null);
    setSuccess(null);
    try {
      await requestRef.current("config.apply", { raw, baseHash: hash });
      setSuccess("Config applied");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }, [raw, hash, load]);

  return {
    loading,
    saving,
    applying,
    error,
    success,
    raw,
    setRaw,
    dirty: raw !== rawOriginal,
    valid,
    issues,
    save,
    apply,
    reload: load,
  };
}
