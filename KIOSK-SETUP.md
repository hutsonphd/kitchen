# Kitchen Calendar Kiosk Setup Guide

This guide will help you set up the Kitchen Calendar application to run automatically in fullscreen kiosk mode on an Intel NUC running Linux Mint (or any Debian-based Linux distribution).

---

## Overview

The Kitchen Calendar will:
- Boot automatically when the system starts
- Run in fullscreen mode (Chromium kiosk mode)
- Display calendar events from your CalDAV sources
- Show a Ken Burns-style screensaver every sync interval (60 seconds)
- Sync calendar data every minute

---

## Prerequisites

- Intel NUC (or any PC) with Linux Mint installed
- Network connection (for CalDAV sync)
- Node.js and npm installed (for development)
- Or pre-built Docker images (for production)

---

## Option 1: Chromium Kiosk Mode (Recommended)

This is the simplest and most reliable method for running the calendar in kiosk mode.

### Step 1: Install Chromium

```bash
sudo apt update
sudo apt install chromium-browser -y
```

### Step 2: Build the Application

On your development machine or the NUC itself:

```bash
cd /path/to/kitchen
npm install
npm run build
```

This creates a production build in the `dist/` directory.

### Step 3: Set Up a Local Web Server

You can use the included backend server to serve the built files:

```bash
# Create a simple startup script
cat > ~/start-calendar.sh << 'EOF'
#!/bin/bash
cd /path/to/kitchen
npm run dev &
sleep 5
chromium-browser --kiosk --disable-infobars --noerrdialogs --disable-session-crashed-bubble http://localhost:5173
EOF

chmod +x ~/start-calendar.sh
```

**Note:** For production, you should use Docker (see Option 2 below) instead of `npm run dev`.

### Step 4: Auto-Start on Boot

Create an autostart entry to launch the calendar when the system boots:

```bash
mkdir -p ~/.config/autostart

cat > ~/.config/autostart/kitchen-calendar.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Kitchen Calendar Kiosk
Exec=/home/YOUR_USERNAME/start-calendar.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

**Replace `YOUR_USERNAME` with your actual Linux username.**

### Step 5: Configure Display Settings

To prevent the screen from sleeping:

```bash
# Disable screen blanking
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0
gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0

# Disable screensaver
gsettings set org.cinnamon.desktop.screensaver lock-enabled false
gsettings set org.cinnamon.desktop.session idle-delay 0
```

### Step 6: Reboot and Test

```bash
sudo reboot
```

The calendar should automatically start in fullscreen mode when the system boots.

---

## Option 2: Docker Deployment (Production)

For a more robust production setup, use Docker.

### Step 1: Install Docker and Docker Compose

```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER
```

Log out and back in for group changes to take effect.

### Step 2: Build and Start Containers

```bash
cd /path/to/kitchen
docker-compose up --build -d
```

This starts:
- Frontend on port 80
- Backend on port 3001
- Nginx reverse proxy

### Step 3: Create Kiosk Startup Script

```bash
cat > ~/start-calendar.sh << 'EOF'
#!/bin/bash
# Wait for Docker to be ready
sleep 10

# Start the calendar in kiosk mode
chromium-browser --kiosk --disable-infobars --noerrdialogs --disable-session-crashed-bubble http://localhost
EOF

chmod +x ~/start-calendar.sh
```

Follow Step 4-6 from Option 1 to set up autostart and display settings.

---

## Screensaver Configuration

The screensaver feature is configured through the Admin Panel.

### Access Admin Panel

1. In kiosk mode, press **Ctrl+Shift+A** to open the Admin Panel
2. Scroll to the "Screensaver Settings" section

### Screensaver Options

- **Enable Screensaver**: Toggle on/off
- **Duration**: How long the screensaver runs (default: 60 seconds)
- **Transition Speed**: Ken Burns animation speed (default: 1000ms)

### Upload Images

1. Click "Upload Images" button
2. Select one or more images (JPG, PNG, GIF, WEBP)
3. Images are stored locally in the browser's IndexedDB
4. Images will cycle with Ken Burns effect (slow zoom and pan)

### Test Screensaver

Click "Test Slideshow" to preview the screensaver without waiting for a sync.

---

## Troubleshooting

### Calendar Doesn't Start on Boot

Check the autostart configuration:

```bash
cat ~/.config/autostart/kitchen-calendar.desktop
```

Verify the script path is correct and executable:

```bash
ls -la ~/start-calendar.sh
```

Check logs:

```bash
# View Chromium errors
journalctl --user -xe | grep chromium
```

### Screen Goes to Sleep

Re-run the display configuration commands from Step 5 in Option 1.

Or use XFCE/Cinnamon Settings GUI:
- System Settings → Power Management → Display
- Set "Put display to sleep" to "Never"
- Disable screensaver

### Screensaver Not Triggering

1. Check if screensaver is enabled in Admin Panel
2. Verify images are uploaded
3. Check browser console for errors (F12 in Chromium)
4. Ensure sync is working (check "Last sync" time in Admin Panel)

### Can't Exit Fullscreen

Press **F11** to exit fullscreen mode, or **Ctrl+Shift+A** to access Admin Panel first, then click "Back to Kiosk View."

---

## Advanced Configuration

### Custom Resolution

Edit your display settings:

```bash
xrandr  # List available resolutions
xrandr --output HDMI-1 --mode 1920x1080  # Set resolution
```

Add to `~/.xprofile` to make permanent:

```bash
echo "xrandr --output HDMI-1 --mode 1920x1080" >> ~/.xprofile
```

### Remote Access

To access the calendar remotely for configuration:

```bash
# Install SSH server
sudo apt install openssh-server -y

# Enable SSH
sudo systemctl enable ssh
sudo systemctl start ssh

# Find IP address
ip addr show
```

Connect via SSH from another computer:

```bash
ssh username@NUC_IP_ADDRESS
```

You can also access the web interface remotely by navigating to `http://NUC_IP_ADDRESS` in a browser.

### Disable Mouse Cursor

To hide the mouse cursor in kiosk mode:

```bash
sudo apt install unclutter -y

# Add to startup script
cat > ~/start-calendar.sh << 'EOF'
#!/bin/bash
unclutter -idle 0.1 &
cd /path/to/kitchen
npm run dev &
sleep 5
chromium-browser --kiosk --disable-infobars --noerrdialogs --disable-session-crashed-bubble http://localhost:5173
EOF
```

### Network Issues

If the NUC loses network connection:

```bash
# Set up automatic network reconnection
sudo apt install network-manager -y
sudo systemctl enable NetworkManager
sudo systemctl start NetworkManager
```

---

## Syncing and Updates

### Calendar Sync

The calendar automatically syncs every 60 seconds (configurable in `App.tsx:8`).

### Update the Application

To update the calendar app:

```bash
cd /path/to/kitchen
git pull origin main
npm install
npm run build

# If using Docker:
docker-compose down
docker-compose up --build -d
```

### Backup Configuration

Calendar sources and settings are stored in browser localStorage. To back up:

1. Open browser dev tools (F12)
2. Go to Application → Local Storage → `http://localhost`
3. Export keys manually or use browser export tools

---

## Security Considerations

### Firewall

If exposing the calendar to a network:

```bash
# Install firewall
sudo apt install ufw -y

# Allow only local access (optional)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24  # Your local network
sudo ufw enable
```

### CalDAV Credentials

Calendar credentials are stored in browser localStorage. For additional security:

1. Use a dedicated CalDAV account with read-only access
2. Don't expose the NUC to the public internet
3. Keep Linux Mint updated with security patches

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Performance Tips

### Reduce Memory Usage

If running on limited hardware:

```bash
# Limit Chromium's memory usage
chromium-browser --kiosk --max-old-space-size=512 --disable-dev-shm-usage http://localhost
```

### Optimize Image Sizes

For smoother screensaver performance:

- Use optimized JPG images (80-90% quality)
- Recommended resolution: 1920x1080 or lower
- Keep total image storage under 500MB

---

## Additional Resources

- [Chromium Kiosk Mode Documentation](https://www.chromium.org/developers/how-tos/run-chromium-with-flags/)
- [Linux Mint User Guide](https://linuxmint.com/documentation.php)
- [Docker Documentation](https://docs.docker.com/)
- [Project GitHub Repository](https://github.com/hutsonphd/kitchen)

---

## Support

For issues or questions:

1. Check the [GitHub Issues](https://github.com/hutsonphd/kitchen/issues)
2. Review the project's CLAUDE.md and DOCKER.md documentation
3. Check browser console for JavaScript errors (F12 → Console tab)

---

**Last Updated:** 2025-11-02
**Version:** 1.0
