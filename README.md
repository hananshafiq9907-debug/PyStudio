# PyStudio — Rebuilt Browser Python IDE

Open `index.html` in a modern browser. The editor, project files, search, notebook, debugger, visualization, problems, command palette, settings, local storage, import/export and coding assistant UI work without a backend.

## Python execution
PyStudio uses Pyodide in a Web Worker. The first Python run downloads the Python runtime from jsDelivr, so the initial load can take time and requires internet access. After the runtime is cached by the browser, subsequent starts are faster.

If browser Python cannot load, the included FastAPI backend can execute Python on the machine/server instead.

## Backend
```bash
cd backend
python -m venv .venv
# activate the venv
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The frontend's backend bridge defaults to `http://localhost:8000`.

## Important limitation
A static web page cannot contain a full CPython interpreter without shipping a very large runtime. Therefore a real browser Python IDE must either download a runtime such as Pyodide or connect to a Python server. This build makes both paths explicit instead of pretending Python is locally available when it is not.
