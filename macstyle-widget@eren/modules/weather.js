import St from 'gi://St';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

const POSITION_FILE = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'weather-widget-position.json']);

// Uzantı yolunu ve ikon klasörünü otomatik bulur
const Me = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions', 'macstyle-widget@eren']));
const ICON_DIR = Me.get_child('icons').get_path();

export const WeatherWidget = GObject.registerClass(
class WeatherWidget extends St.BoxLayout {

    _init(lat = 40.19, lon = 29.06, cityName = "Yükleniyor...") {
        super._init({
            style_class: 'weather-widget',
            vertical: true,
            reactive: true,
            can_focus: true
        });

        this._lat = lat;
        this._lon = lon;
        this._session = new Soup.Session();

this._cityLabel = new St.Label({
            text: cityName.toUpperCase(),
            style_class: "weather-city"
        });

        // İkon ve dereceyi yan yana tutacak yeni yatay kutu
        this._currentWeatherBox = new St.BoxLayout({
            vertical: false,
            style_class: "weather-current-box",
            y_align: Clutter.ActorAlign.CENTER // İkon ve metni dikeyde hizalar
        });

        // Ana ikon
        this._mainIcon = new St.Icon({
            icon_size: 32,
            style_class: "weather-main-icon"
        });

        // Derece etiketi
        this._currentLabel = new St.Label({
            text: "--°C",
            style_class: "weather-current",
            style: 'margin-left: 8px;' // İkonla derece arasına küçük bir boşluk
        });

        // İkon ve dereceyi yatay kutuya ekle
        this._currentWeatherBox.add_child(this._mainIcon);
        this._currentWeatherBox.add_child(this._currentLabel);

        this._daysBox = new St.BoxLayout({
            style_class: "weather-days",
            x_expand: true
        });

        // Ana dikey kutuya (Widget) sırayla ekle
        this.add_child(this._cityLabel);          // En üstte şehir
        this.add_child(this._currentWeatherBox);  // Ortada İkon + Derece (Yan yana)
        this.add_child(this._daysBox);            // En altta 5 günlük tahmin

        this._enableDrag();
        this._getLocation(); // Önce konumu ve şehri bulur
        this._startLoop();
    }

    // IP üzerinden Şehir ve Koordinat bulma
    _getLocation() {
        let msg = Soup.Message.new('GET', 'http://ip-api.com/json');
        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, r) => {
            try {
                let bytes = s.send_and_read_finish(r);
                let data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                if (data.status === 'success') {
                    this._lat = data.lat;
                    this._lon = data.lon;
                    this._cityLabel.text = data.city.toUpperCase();
                }
            } catch (e) {
                this._cityLabel.text = "BURSA"; // Hata olursa varsayılan
            }
            this._fetchWeather();
        });
    }

    _fetchWeather() {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${this._lat}&longitude=${this._lon}&current_weather=true&daily=temperature_2m_max,weathercode&timezone=auto`;
        
        let msg = Soup.Message.new('GET', url);
        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, r) => {
            try {
                let bytes = s.send_and_read_finish(r);
                let data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                this._render(data);
            } catch (e) {
                console.error("Weather error: " + e);
            }
        });
    }

    // Sayısal kodu ikon dosyasına çeviren yardımcı fonksiyon
    _getGIcon(code) {
        let iconName = "mist.png"; // Varsayılan

        if (code === 0) iconName = "sun.png";
        else if (code <= 3) iconName = "cloud-sun.png";
        else if (code <= 48) iconName = "cloud.png";
        else if (code <= 67) iconName = "rain.png";
        else if (code <= 77) iconName = "snow.png";
        else if (code <= 82) iconName = "rain2.png";
        else if (code >= 95) iconName = "thunder.png";

        let iconFile = Gio.File.new_for_path(`${ICON_DIR}/${iconName}`);
        return Gio.Icon.new_for_string(iconFile.get_path());
    }

    _render(data) {
        let cur = data.current_weather;
        this._currentLabel.text = `${Math.round(cur.temperature)}°C`;
        
        // Ana ikonu güncelle
        this._mainIcon.gicon = this._getGIcon(cur.weathercode);

        this._daysBox.destroy_all_children();

        let days = data.daily;
        for (let i = 0; i < 5; i++) {
            let box = new St.BoxLayout({ vertical: true, style_class: "weather-day-box" });
            
            // Günlük ikonları St.Icon olarak değiştiriyoruz
            let icon = new St.Icon({ 
                gicon: this._getGIcon(days.weathercode[i]), 
                icon_size: 32,
                style_class: "weather-small-icon", 
                style: 'margin: 1px; width: 1px;'
            });

            let temp = new St.Label({ text: `${Math.round(days.temperature_2m_max[i])}°` });
            let dateObj = new Date(days.time[i]);
            let dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'short' });
            let dateLabel = new St.Label({ text: dayName, style_class: "weather-date" });
            
            box.add_child(icon); 
            box.add_child(temp); 
            box.add_child(dateLabel);
            this._daysBox.add_child(box);
        }
    }

    // Sürükleme, Döngü ve Kayıt fonksiyonları (Aynen korundu)
    _enableDrag() {

        this._dragging = false;

        this.connect('button-press-event', (actor, event) => {
            this._dragging = true;

            let [x, y] = event.get_coords();
            let [ax, ay] = this.get_position();

            this._dx = x - ax;
            this._dy = y - ay;

            return Clutter.EVENT_STOP;
        });

this.connect('motion-event', (actor, event) => {

    if (!this._dragging)
        return Clutter.EVENT_PROPAGATE;

    let [x, y] = event.get_coords();

    let newX = x - this._dx;
    let newY = y - this._dy;

    this.set_position(newX, newY);

    // 💾 pozisyon kaydet
    this._savePosition(newX, newY);

    return Clutter.EVENT_STOP;
});

        this.connect('button-release-event', () => {
            this._dragging = false;
            return Clutter.EVENT_STOP;
        });
    }


    _startLoop() {
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1800, () => {
            this._fetchWeather();
            return true;
        });
    }

    _savePosition(x, y) {

    let data = JSON.stringify({
        x: Math.round(x),
        y: Math.round(y)
    });

    GLib.file_set_contents(
        POSITION_FILE,
        data
    );
}

   _loadPosition() {

    try {

        let [ok, contents] =
            GLib.file_get_contents(POSITION_FILE);

        if (!ok)
            return [800, 120];

        let data = JSON.parse(contents);

        return [data.x, data.y];

    } catch(e) {

        return [800, 120];
    }
}

    destroy() {
        if (this._timeout) GLib.source_remove(this._timeout);
        super.destroy();
    }
});
