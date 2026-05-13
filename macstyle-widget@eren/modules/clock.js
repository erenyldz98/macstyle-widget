import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';

export const ClockWidget = GObject.registerClass(
class ClockWidget extends St.BoxLayout {
    _init() {
        // 1. Ana Konteyner Ayarları
        super._init({
            style_class: 'clock-container',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        // Pozisyon kayıt dosyası
        this._configFile = Gio.File.new_for_path(
            GLib.build_filenamev([GLib.get_home_dir(), '.config', 'macstyle-clock-position.json'])
        );

        // 2. Saat Etiketi (Label) Oluşturma
        this._label = new St.Label({
            style_class: 'desktop-clock',
            text: this._getTime()
        });

        // ".." Hatasını Engelleyen Kesin Ayarlar
        this._label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._label.clutter_text.set_line_wrap(false);
        this._label.clutter_text.set_single_line_mode(true);

        this.add_child(this._label);

        // 3. Sürükleme ve Zamanlayıcıyı Başlat
        this._enableDrag();
        this._startTimer();
    }

    _getTime() {
        return GLib.DateTime.new_now_local().format("%H:%M");
    }

    _startTimer() {
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._label.set_text(this._getTime());
            return true;
        });
    }

    _enableDrag() {
        this._dragging = false;
        
        this.connect('button-press-event', (actor, event) => {
            this._dragging = true;
            let [x, y] = event.get_coords();
            let [ax, ay] = this.get_position();
            this._offset = [x - ax, y - ay];
            return Clutter.EVENT_STOP;
        });

        this.connect('motion-event', (actor, event) => {
            if (!this._dragging) return Clutter.EVENT_PROPAGATE;
            let [x, y] = event.get_coords();
            this.set_position(x - this._offset[0], y - this._offset[1]);
            return Clutter.EVENT_STOP;
        });

        this.connect('button-release-event', () => {
            if (this._dragging) {
                this._dragging = false;
                this._savePosition();
            }
            return Clutter.EVENT_STOP;
        });
    }

    _savePosition() {
        let [x, y] = this.get_position();
        let data = JSON.stringify({ x: Math.round(x), y: Math.round(y) });
        try {
            GLib.file_set_contents(this._configFile.get_path(), data);
        } catch (e) {
            log(`Saat pozisyonu kaydedilemedi: ${e.message}`);
        }
    }

    _loadPosition() {
        try {
            let [ok, contents] = GLib.file_get_contents(this._configFile.get_path());
            if (ok) {
                let pos = JSON.parse(new TextDecoder().decode(contents));
                return [pos.x, pos.y];
            }
        } catch (e) {
            // Dosya yoksa veya hata varsa varsayılan pozisyon
        }
        return [100, 100];
    }

    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        super.destroy();
    }
});
