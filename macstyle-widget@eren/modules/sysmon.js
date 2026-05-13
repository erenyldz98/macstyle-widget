import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

const CircleGauge = GObject.registerClass(
class CircleGauge extends St.DrawingArea {
    _init(label, color) {
        super._init({
            style_class: 'macstyle-gauge',
            width: 120,
            height: 150,
        });
        this.label = label;
        this.color = color;
        this.value = 0;
        this.displayValue = "0%"; // Ekranda görünecek metin
        this.connect('repaint', this._onRepaint.bind(this));
    }

    setValue(v, text = null) {
        this.value = Math.max(0, Math.min(v, 100));
        this.displayValue = text || `${this.value.toFixed(0)}%`;
        this.queue_repaint();
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const w = area.width;
        const h = area.height;
        const r = Math.min(w, h / 1.2) / 2 - 15;
        const cx = w / 2;
        const cy = h / 2 + 10;

        // Arka plan dairesi
        cr.setLineWidth(8);
        cr.setSourceRGBA(1, 1, 1, 0.08);
        cr.arc(cx, cy, r, 0, Math.PI * 2);
        cr.stroke();

        // Doluluk dairesi
        const angle = (this.value / 100) * 2 * Math.PI;
        cr.setSourceRGBA(this.color[0], this.color[1], this.color[2], 1);
        cr.arc(cx, cy, r, -Math.PI / 2, angle - Math.PI / 2);
        cr.stroke();

        // Başlık (CPU, RAM, NET)
        cr.setSourceRGBA(1, 1, 1, 0.6);
        cr.selectFontFace("Sans", 0, 1); // Bold
        cr.setFontSize(12);
        const labelExtents = cr.textExtents(this.label);
        cr.moveTo(cx - labelExtents.width / 2, cy - r - 16);
        cr.showText(this.label);

        // Değer metni (Merkezdeki %)
        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.setFontSize(14);
        const valExtents = cr.textExtents(this.displayValue);
        cr.moveTo(cx - valExtents.width / 2, cy + 5);
        cr.showText(this.displayValue);
    }
});

export const SysMonModule = GObject.registerClass(
class SysMonModule extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'macstyle-container',
            vertical: false,
            reactive: true,
        });

        this._lastCPU = null;
        this._lastNetBytes = 0;
        this._lastNetTime = GLib.get_monotonic_time();

        this.cpu = new CircleGauge('CPU', [1, 1, 1]);
        this.ram = new CircleGauge('RAM', [1, 1, 1]);
        this.net = new CircleGauge('NET', [1, 1, 1]);

        this.add_child(this.cpu);
        this.add_child(this.ram);
        this.add_child(this.net);

        this._enableDrag();
        this._update();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this._update();
            return true;
        });
    }

    _getCPU() {
        try {
            const [, out] = GLib.spawn_command_line_sync("cat /proc/stat");
            const text = new TextDecoder().decode(out);
            const line = text.split("\n")[0];
            const parts = line.split(/\s+/);
            const user = parseInt(parts[1]), system = parseInt(parts[3]), idle = parseInt(parts[4]);
            const total = user + system + idle;
            if (!this._lastCPU) { this._lastCPU = { total, idle }; return 0; }
            const totalDiff = total - this._lastCPU.total;
            const idleDiff = idle - this._lastCPU.idle;
            this._lastCPU = { total, idle };
            return ((totalDiff - idleDiff) / totalDiff) * 100;
        } catch { return 0; }
    }

    _getRAM() {
        try {
            const [, out] = GLib.spawn_command_line_sync("free -b");
            const lines = new TextDecoder().decode(out).split("\n");
            const memLine = lines[1].split(/\s+/);
            return (parseInt(memLine[2]) / parseInt(memLine[1])) * 100;
        } catch { return 0; }
    }

    _getNetUsage() {
        try {
            const [, out] = GLib.spawn_command_line_sync("cat /proc/net/dev");
            const lines = new TextDecoder().decode(out).split("\n");
            let totalBytes = 0;
            // İlk iki satır başlık, diğer satırlar arayüzler (wlan0, eth0 vb.)
            for (let i = 2; i < lines.length; i++) {
                const parts = lines[i].trim().split(/\s+/);
                if (parts.length > 10) {
                    totalBytes += parseInt(parts[1]) + parseInt(parts[9]); // Receive + Transmit
                }
            }

            const now = GLib.get_monotonic_time();
            const timeDiff = (now - this._lastNetTime) / 1000000; // Saniye cinsinden
            const byteDiff = totalBytes - this._lastNetBytes;
            
            this._lastNetBytes = totalBytes;
            this._lastNetTime = now;

            if (timeDiff <= 0) return [0, "0KB/s"];
            
            const speedKB = (byteDiff / 1024) / timeDiff;
            // 10MB/s (10240 KB/s) hızını %100 doluluk kabul edelim
            const percentage = (speedKB / 10240) * 100;
            
            let label = speedKB > 1024 
                ? `${(speedKB / 1024).toFixed(1)}MB/s` 
                : `${speedKB.toFixed(0)}KB/s`;
                
            return [percentage, label];
        } catch { return [0, "0KB/s"]; }
    }

    _update() {
        this.cpu.setValue(this._getCPU());
        this.ram.setValue(this._getRAM());
        
        const [netPercent, netLabel] = this._getNetUsage();
        this.net.setValue(netPercent, netLabel);
    }

    _enableDrag() {
        this._dragging = false;
        this.connect('button-press-event', () => { this._dragging = true; return Clutter.EVENT_STOP; });
        this.connect('motion-event', (actor, event) => {
            if (!this._dragging) return Clutter.EVENT_STOP;
            const [x, y] = event.get_coords();
            this.set_position(x - 60, y - 60);
            return Clutter.EVENT_STOP;
        });
        this.connect('button-release-event', () => {
            this._dragging = false;
            let [x, y] = this.get_position();
            // Snap to grid mantığın
            const nx = Math.round(x / 20) * 20;
            const ny = Math.round(y / 20) * 20;
            this.set_position(nx, ny);
            this._savePosition(nx, ny);
            return Clutter.EVENT_STOP;
        });
    }

    
        _savePosition(x, y) {
        const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'macstyle-widget-position.json']);
        const file = Gio.File.new_for_path(path);
        const data = new TextEncoder().encode(JSON.stringify({ x, y }));
        file.replace_contents_bytes_async(GLib.Bytes.new(data), null, false, Gio.FileCreateFlags.NONE, null, () => {});
    }

    _loadPosition() {
        try {
            const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'macstyle-widget-position.json']);
            const file = Gio.File.new_for_path(path);
            const [, contents] = file.load_contents(null);
            const data = JSON.parse(new TextDecoder().decode(contents));
            return [data.x, data.y];
        } catch { return [40, 120]; }
    }

    destroy() {
        if (this._timer) GLib.source_remove(this._timer);
        super.destroy();
    }
});
