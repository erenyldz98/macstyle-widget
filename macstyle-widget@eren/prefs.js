import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {
    ExtensionPreferences
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class macstylewidgetPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
    
    // 1. Resim için ayrı bir grup oluştur
const imageGroup = new Adw.PreferencesGroup();

// 2. Resim dosyasının yolunu belirle (Klasördeki adı logo.png olmalı)
const file = Gio.File.new_for_path(`${this.path}/logo.png`);

// 3. Resim bileşenini oluştur
const picture = new Gtk.Picture({
    file: file,
    hexpand: true,
    halign: Gtk.Align.CENTER,
});

// 4. Boyutu 300x300 olarak ayarla
picture.set_size_request(300, 300);

// 5. Gruba resmi ekle
imageGroup.add(picture);

        const settings = this.getSettings();
        
        // Ana Sayfa
        const page = new Adw.PreferencesPage({
            title: 'Genel Ayarlar',
            icon_name: 'view-module-symbolic'
        });

        // Modüller Grubu
        const group = new Adw.PreferencesGroup({
            title: 'Dashboard Modülleri',
            description: 'Ekranda görünmesini istediğiniz bileşenleri seçin.'
        });

        // Satır oluşturma yardımcı fonksiyonu
        const createModuleRow = (title, subtitle, key, icon) => {
            const row = new Adw.ActionRow({
                title: title,
                subtitle: subtitle
            });

            // İkon ekleyelim (Opsiyonel ama şık durur)
            if (icon) {
                const img = new Gtk.Image({ icon_name: icon });
                row.add_prefix(img);
            }

            const toggle = new Gtk.Switch({
                active: settings.get_boolean(key),
                valign: Gtk.Align.CENTER
            });

            // Switch ile Ayarları Birbirine Bağla (Otomatik Kayıt)
            settings.bind(
                key,
                toggle,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            );

            row.add_suffix(toggle);
            row.activatable_widget = toggle; // Satıra tıklayınca da açılıp kapansın
            return row;
        };

        // Modülleri Ekle
        group.add(createModuleRow('Medya kontrolü', 'Medyanızı durdurun veya oynatın', 'show-media', 'audio-x-generic-symbolic'));
        group.add(createModuleRow('Saat Modülü', 'Dijital saati ve tarihi gösterir', 'show-clock', 'preferences-system-time-symbolic'));
        group.add(createModuleRow('Sistem Monitörü', 'CPU ve RAM kullanımını gösterir', 'show-sysmon', 'utilities-system-monitor-symbolic'));
        group.add(createModuleRow('Hava Durumu', 'Anlık hava durumu ve tahminleri gösterir', 'show-weather', 'weather-clear-symbolic'));
        page.add(imageGroup);
        page.add(group);
        window.add(page);
    }
}
