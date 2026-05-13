import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ClockWidget } from './modules/clock.js';
import { SysMonModule } from './modules/sysmon.js';
import { WeatherWidget } from './modules/weather.js';
import { MediaModule } from './modules/media.js'; // Medya modülü import edildi

export default class macstyleDashboard extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._widgets = new Map();

        // Ayar değişikliklerini izle (show-media eklendi)
        const keys = ['show-clock', 'show-sysmon', 'show-weather', 'show-media'];
        keys.forEach(key => {
            this._settings.connect(`changed::${key}`, () => this._sync());
        });

        this._sync();
    }

    _sync() {
        const configs = [
            { key: 'show-clock', class: ClockWidget, id: 'clock' },
            { key: 'show-sysmon', class: SysMonModule, id: 'sysmon' },
            { key: 'show-weather', class: WeatherWidget, id: 'weather' },
            { key: 'show-media', class: MediaModule, id: 'media' } // Medya konfigürasyonu eklendi
        ];

        configs.forEach(conf => {
            const active = this._settings.get_boolean(conf.key);
            let widget = this._widgets.get(conf.id);

            if (active && !widget) {
                widget = new conf.class();
                Main.layoutManager._backgroundGroup.add_child(widget);
                
                // Kayıtlı pozisyonu yükle
                if (widget._loadPosition) {
                    let pos = widget._loadPosition();
                    widget.set_position(pos[0], pos[1]);
                }
                this._widgets.set(conf.id, widget);
            } else if (!active && widget) {
                widget.destroy();
                this._widgets.delete(conf.id);
            }
        });
    }

    disable() {
        if (this._widgets) {
            this._widgets.forEach(w => w.destroy());
            this._widgets.clear();
        }
        this._settings = null;
    }
}
