# Linux Mint Kiosk Setup Guide for Kitchen Calendar

Here's a complete step-by-step guide to configure your Linux Mint machine as a dedicated kiosk:

## Prerequisites
- Fresh or existing Linux Mint installation
- User account that will run the kiosk (e.g., "kiosk" or your current user)
- Internet connection

---

## Step 1: Install Required Software

```bash
sudo apt update
sudo apt install -y chromium-browser unclutter xdotool
```

- **chromium-browser**: Open-source Chrome browser
- **unclutter**: Hides mouse cursor after inactivity
- **xdotool**: Automates keypresses for fullscreen mode

---

## Step 2: Disable Screensaver and Power Management

### A. Disable Screensaver via Settings GUI
1. Open **Menu** → **Preferences** → **Screensaver**
2. Uncheck "Activate screensaver when computer is idle"
3. Close the window

### B. Disable Power Management via Terminal
```bash
# Disable screen blanking
gsettings set org.cinnamon.desktop.screensaver idle-activation-enabled false
gsettings set org.cinnamon.desktop.session idle-delay 0

# Disable sleep/suspend
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout 0

# Disable screen power management
xset s off
xset -dpms
xset s noblank
```

---

## Step 3: Create Kiosk Startup Script

Create the kiosk launch script:

```bash
mkdir -p ~/.local/bin
nano ~/.local/bin/kiosk-start.sh
```

Paste the following content:

```bash
#!/bin/bash

# Disable power management and screensaver
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor after 5 seconds of inactivity
unclutter -idle 5 &

# Wait for desktop to fully load
sleep 5

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  https://kitchen.hutson.cloud
```

Make it executable:

```bash
chmod +x ~/.local/bin/kiosk-start.sh
```

---

## Step 4: Configure Auto-Start on Login

### Method A: Using Startup Applications GUI (Recommended)
1. Open **Menu** → **Preferences** → **Startup Applications**
2. Click **Add** (+ button)
3. Fill in:
   - **Name**: Kitchen Kiosk
   - **Command**: `/home/YOUR_USERNAME/.local/bin/kiosk-start.sh`
   - **Comment**: Auto-start calendar kiosk
4. Click **Add**
5. Close the window

### Method B: Using Desktop Entry File (Alternative)
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

Paste this content (replace YOUR_USERNAME):

```ini
[Desktop Entry]
Type=Application
Name=Kitchen Kiosk
Comment=Auto-start calendar kiosk
Exec=/home/YOUR_USERNAME/.local/bin/kiosk-start.sh
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true
```

---

## Step 5: Configure Auto-Login (Optional but Recommended)

1. Open **Menu** → **Administration** → **Login Window**
2. Enter your password when prompted
3. Go to the **Users** tab
4. Select your user account
5. Enable **Log in automatically**
6. Click **Close**

---

## Step 6: Prevent Screen Locking

```bash
# Disable screen lock
gsettings set org.cinnamon.desktop.lockdown disable-lock-screen true
gsettings set org.cinnamon.desktop.screensaver lock-enabled false
```

---

## Step 7: Make Power Settings Persistent

Create a script to enforce power settings at startup:

```bash
nano ~/.local/bin/disable-power-management.sh
```

Paste:

```bash
#!/bin/bash
gsettings set org.cinnamon.desktop.screensaver idle-activation-enabled false
gsettings set org.cinnamon.desktop.session idle-delay 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0
xset s off
xset -dpms
xset s noblank
```

Make executable:

```bash
chmod +x ~/.local/bin/disable-power-management.sh
```

Add to Startup Applications (same as Step 4, Method A):
- **Name**: Disable Power Management
- **Command**: `/home/YOUR_USERNAME/.local/bin/disable-power-management.sh`
- **Startup delay**: 0 seconds

---

## Step 8: Configure System to Never Sleep (System-wide)

Edit system power settings:

```bash
sudo nano /etc/systemd/logind.conf
```

Uncomment and set these lines:

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
IdleActionSec=infinity
```

Restart the service:

```bash
sudo systemctl restart systemd-logind
```

---

## Step 9: Test the Setup

1. **Log out** or **restart** your system
2. The system should:
   - Auto-login
   - Launch Chrome in fullscreen with your calendar
   - Hide the mouse cursor after 5 seconds
   - Never show screensavers or go to sleep

---

## Step 10: Recovery Access (Important!)

To exit kiosk mode if you need to access the desktop:

- **Press**: `Ctrl + Alt + F2` → Switch to terminal (TTY2)
- **Login** with your username and password
- **Kill kiosk**: `pkill chromium-browser`
- **Return to desktop**: Press `Ctrl + Alt + F7` or `Ctrl + Alt + F8`

Or simply press `Alt + F4` when the kiosk is running to close Chrome.

---

## Troubleshooting

### Chrome doesn't start in fullscreen
- Add this line to `kiosk-start.sh` after the chromium launch:
  ```bash
  sleep 3 && xdotool key F11
  ```

### Screen still blanks
- Check if other power management tools are installed:
  ```bash
  sudo apt remove gnome-screensaver xscreensaver
  ```

### Auto-login not working
- Verify in `/etc/lightdm/lightdm.conf`:
  ```bash
  sudo nano /etc/lightdm/lightdm.conf
  ```
- Look for or add under `[Seat:*]`:
  ```ini
  autologin-user=YOUR_USERNAME
  autologin-user-timeout=0
  ```

### Mouse cursor visible
- Increase unclutter idle time: `unclutter -idle 1 &`

---

## Summary Checklist

- [ ] Chromium browser installed
- [ ] Screensaver disabled (GUI + gsettings)
- [ ] Power management disabled (gsettings + systemd)
- [ ] Kiosk startup script created and executable
- [ ] Auto-start configured
- [ ] Auto-login enabled
- [ ] Screen lock disabled
- [ ] System tested with reboot

---

This setup creates a "set and forget" kiosk that will reliably display your Kitchen calendar at https://kitchen.hutson.cloud in fullscreen mode without interruptions.

**Last Updated:** 2025-11-03
