import St from 'gi://St';
import GObject from 'gi://GObject';

export const CircleGauge = GObject.registerClass(
class CircleGauge extends St.DrawingArea {

    _init(label, color) {
        super._init({
            style_class: 'macstyle-gauge',
            width: 120,
            height: 120,
        });

        this.label = label;
        this.color = color;
        this.value = 0;

        this.connect('repaint', this._draw.bind(this));
    }

    setValue(v) {
        this.value = Math.max(0, Math.min(v, 100));
        this.queue_repaint();
    }

    _draw(area) {

        const cr = area.get_context();

        const w = area.width;
        const h = area.height;
        const r = Math.min(w, h) / 2 - 10;

        const cx = w / 2;
        const cy = h / 2;

        cr.setLineWidth(8);
        cr.setSourceRGBA(1, 1, 1, 0.08);
        cr.arc(cx, cy, r, 0, Math.PI * 2);
        cr.stroke();

        const angle = (this.value / 100) * 2 * Math.PI;

        cr.setSourceRGBA(...this.color, 1);
        cr.arc(cx, cy, r, -Math.PI / 2, angle - Math.PI / 2);
        cr.stroke();

        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.setFontSize(14);
        cr.moveTo(cx - 18, cy + 5);
        cr.showText(`${this.value.toFixed(0)}%`);
    }
});
