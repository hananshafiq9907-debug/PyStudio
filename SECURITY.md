# PyStudio Security Checklist

Before public deployment:
1. Put Python execution in disposable containers/VMs.
2. Disable network access for untrusted code by default.
3. Apply CPU, memory, process, disk and wall-clock limits.
4. Never mount host secrets, Docker socket, SSH keys or cloud credentials.
5. Run workers as non-root with a read-only image.
6. Validate project/file paths against traversal.
7. Add authentication and per-user authorization.
8. Add rate limits and quotas.
9. Scan uploads and restrict dangerous file types.
10. Store secrets only server-side.
11. Use HTTPS/WSS.
12. Add audit logs and worker cleanup.
13. For AI, proxy requests server-side; never ship provider API keys to the browser.
14. Add CSRF/origin protection where applicable.
15. Back up persistent project data.
