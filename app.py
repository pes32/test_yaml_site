from backend import app  # noqa: E402  (создаётся при импорте backend)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, host="127.0.0.1", port=8000)
