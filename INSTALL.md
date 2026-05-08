# SunTran — How to Install

There are two ways to run the app. Pick whichever works best for you.

---

## Option A — Docker (recommended)

No coding knowledge needed. Docker is a free app that runs the tool for you.

### Step 1 — Install Docker Desktop

1. Go to **https://www.docker.com/products/docker-desktop**
2. Download and install it
3. Open **Docker Desktop** after it installs
4. Wait until you see **"Engine running"** in the bottom left corner before going to Step 2

### Step 2 — Download the App

1. On this GitHub page, click the green **Code** button
2. Click **Download ZIP**
3. Unzip the downloaded file and put the folder somewhere easy to find (Desktop is fine)

### Step 3 — Start the App

- **Windows** — open the folder and double-click **START.bat**
- **Mac** — open the folder and double-click **START.command**
  *(If Mac warns you it can't open it, right-click it → Open → Open)*

A terminal window will open and the app will build. **The first time takes 1–3 minutes.** After that it starts in under 30 seconds.

Your browser will open automatically when it is ready.

### Step 4 — Log In

Go to **http://localhost:5176** (opens automatically)

- **Username:** admin
- **Password:** suntran

### Step 5 — Load Your Data

1. Click the **Import** tab
2. Upload your SunTran files under **Raw AVL/APC Vendor Files**
3. Each file shows a preview — click **Import** to confirm

### Stopping the App

Click the terminal window and press **Enter** (Mac) or any key (Windows). Your data is always saved.

---

## Option B — Standalone Executable (no Docker needed)

If you would rather not install Docker, you can run the app as a regular program. Nothing else needs to be installed.

### Step 1 — Download the app folder

The executable comes as a folder called **SunTran**. Download it and put it somewhere on your computer.

### Step 2 — Run it

- **Windows** — open the SunTran folder and double-click **SunTran.exe**
  *(If Windows warns you, click "More info" → "Run anyway")*
- **Mac** — open the SunTran folder and double-click **SunTran**
  *(If Mac warns you, right-click it → Open → Open)*

A small terminal window opens. Your browser will open automatically in a few seconds.

### Step 3 — Log In

Go to **http://localhost:8000** (opens automatically)

- **Username:** admin
- **Password:** suntran

### Step 4 — Load Your Data

Same as Option A — click **Import** and upload your SunTran files.

### Stopping the App

Close the terminal window. Your data is always saved.

> **Your data lives in the `data` folder inside the SunTran folder.**
> Keep that folder safe — it holds everything you have imported.

---

## Questions

Contact Justin Becerra — jstnbcrr@gmail.com
