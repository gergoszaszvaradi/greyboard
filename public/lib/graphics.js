export default class Graphics {
    constructor() {
        this.cachedImages = {};
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.ctx.textBaseline = "top";
    }
    setView(t, s) {
        this.ctx.scale(s, s);
        this.ctx.translate(t.x, t.y);
    }
    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
    }
    stroke(color, weight = 0) {
        if (weight > 0)
            this.ctx.lineWidth = weight;
        this.ctx.strokeStyle = color;
    }
    fill(color) {
        this.ctx.fillStyle = color;
    }
    dash(segments) {
        this.ctx.setLineDash(segments);
    }
    clear(color) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
    }
    rect(x, y, w, h) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    fillRect(x, y, w, h) {
        this.ctx.fillRect(x, y, w, h);
    }
    ellipse(x, y, w, h) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w, h, 0, 0, 360);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    fillEllipse(x, y, w, h) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w, h, 0, 0, 360);
        this.ctx.fill();
        this.ctx.closePath();
    }
    line(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    curve(points) {
        if (points == null || points.length == 0)
            return;
        if (points.length == 1) {
            let fillstyle = this.ctx.fillStyle;
            this.fill(this.ctx.strokeStyle);
            this.fillEllipse(points[0].x, points[0].y, this.ctx.lineWidth / 2, this.ctx.lineWidth / 2);
            this.fill(fillstyle);
            return;
        }
        this.ctx.fillStyle = "#00000000";
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            let p1 = points[i], p2 = points[i + 1];
            let mx = p1.x + (p2.x - p1.x) * 0.5;
            let my = p1.y + (p2.y - p1.y) * 0.5;
            this.ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        }
        this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }
    path(points, rect) {
        if (points == null || points.length == 0)
            return;
        if (points.length == 1) {
            let fillstyle = this.ctx.fillStyle;
            this.fill(this.ctx.strokeStyle);
            this.fillEllipse(points[0].x + rect.x, points[0].y + rect.y, this.ctx.lineWidth / 2, this.ctx.lineWidth / 2);
            this.fill(fillstyle);
            return;
        }
        this.ctx.fillStyle = "#00000000";
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x * rect.w + rect.x, points[0].y * rect.h + rect.y);
        for (let i = 0; i < points.length - 1; i++) {
            let p1x = points[i].x * rect.w + rect.x;
            let p1y = points[i].y * rect.h + rect.y;
            let p2x = points[i + 1].x * rect.w + rect.x;
            let p2y = points[i + 1].y * rect.h + rect.y;
            let mx = p1x + (p2x - p1x) * 0.5;
            let my = p1y + (p2y - p1y) * 0.5;
            this.ctx.quadraticCurveTo(p1x, p1y, mx, my);
        }
        this.ctx.lineTo(points[points.length - 1].x * rect.w + rect.x, points[points.length - 1].y * rect.h + rect.y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }
    polygon(points) {
        if (points == null || points.length == 0)
            return;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.lineTo(points[0].x, points[0].y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }
    img(x, y, w, h, src) {
        if (typeof src === "string") {
            if (!(src in this.cachedImages)) {
                let img = new Image();
                img.src = src;
                this.cachedImages[src] = img;
            }
            this.ctx.drawImage(this.cachedImages[src], x, y, w, h);
        }
        else {
            this.ctx.drawImage(src, x, y, w, h);
        }
    }
    font(family, size, halign = "left", valign = "top") {
        this.ctx.font = `${size}px ${family}`;
        this.ctx.textAlign = halign;
        this.ctx.textBaseline = valign;
    }
    text(x, y, text) {
        this.ctx.fillText(text, x, y);
    }
}
