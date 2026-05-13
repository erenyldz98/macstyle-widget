import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';

export const MediaModule = GObject.registerClass(
class MediaModule extends St.BoxLayout {
    _init() {
super._init({
    style_class: 'macstyle-container',
    vertical: true,
    reactive: true,
    style: 'padding: 14px; width: 250px;' // Stil olarak ekleyebilirsin
});

        this._titleLabel = new St.Label({ text: "Medya Bekleniyor...", style: 'color: white; font-weight: bold; text-align: center; margin-bottom: 13px;' });
        this._btn = new St.Button({ label: '▶/⏸', style: 'background: rgba(255,255,255,0.1); border-radius: 5px; margin-top: 5px;' });
        this._btn.connect('clicked', () => GLib.spawn_command_line_async("playerctl play-pause"));
        
        this._btn = new St.Button({ 
    label: '▶/⏸', 
    style_class: 'media-buttonski'
});

        this.add_child(this._titleLabel);
        this.add_child(this._btn);

        this._enableDrag();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            try {
                let [, out] = GLib.spawn_command_line_sync("playerctl metadata title");
                this._titleLabel.set_text(new TextDecoder().decode(out).trim() || "Durduruldu");
            } catch { this._titleLabel.set_text("playerctl yok!"); }
            return true;
        });
    }

    _enableDrag() {
        this._dragging = false;
        this.connect('button-press-event', () => { this._dragging = true; return Clutter.EVENT_STOP; });
        this.connect('motion-event', (actor, event) => {
            if (!this._dragging) return Clutter.EVENT_STOP;
            const [x, y] = event.get_coords();
            this.set_position(x - this.width / 2, y - this.height / 2);
            return Clutter.EVENT_STOP;
        });
        this.connect('button-release-event', () => {
            this._dragging = false;
            let [nx, ny] = this.get_position();
            nx = Math.round(nx / 20) * 20;
            ny = Math.round(ny / 20) * 20;
            this.set_position(nx, ny);
            this._savePosition(nx, ny);
            return Clutter.EVENT_STOP;
        });
    }

    _savePosition(x, y) {
        const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'macstyle-media-pos.json']);
        const data = new TextEncoder().encode(JSON.stringify({ x, y }));
        Gio.File.new_for_path(path).replace_contents_bytes_async(GLib.Bytes.new(data), null, false, Gio.FileCreateFlags.NONE, null, () => {});
    }

    _loadPosition() {
        try {
            const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'macstyle-media-pos.json']);
            const [, contents] = Gio.File.new_for_path(path).load_contents(null);
            const data = JSON.parse(new TextDecoder().decode(contents));
            return [data.x, data.y];
        } catch { return [40, 300]; }
    }

    destroy() { if (this._timer) GLib.source_remove(this._timer); super.destroy(); }
});
