export class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}
export class Rect {
    constructor(x = 0, y = 0, w = 0, h = 0) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
}
export class ERect extends Rect {
    constructor(x = 0, y = 0, w = 0, h = 0, ox = 0, oy = 0) {
        super(x, y, w, h);
        this.ox = ox;
        this.oy = oy;
    }
}
export function inRange(x, min, max) {
    return (x >= min && x <= max);
}
export function angle(x1, y1, x2, y2) {
    let a = Math.atan2(y1 - y2, x2 - x1) * 180 / Math.PI;
    return (a < 0) ? 360 + a : a;
}
export function lerp(a, b, t) {
    return a + t * (b - a);
}
export function quadLerp(a, b, c, t) {
    let p0 = lerp(a, b, t);
    let p1 = lerp(b, c, t);
    return lerp(p0, p1, t);
}
export function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    let n = ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / n;
    let u = ((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / n;
    return ((t >= 0 && t <= 1) && (u >= -1 && u <= 0));
}
export function rectIntersection(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (!(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1));
}
export function isPointInRect(px, py, x, y, w, h) {
    return (px > x && px < x + w && py > y && py < y + h);
}
export function isLineInRect(lx1, ly1, lx2, ly2, x, y, w, h) {
    return (isPointInRect(lx1, ly1, x, y, w, h) || isPointInRect(lx2, ly2, x, y, w, h));
}
export function generateID(n = 16) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < n; i++)
        id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}
export function toUrlObj(src) {
    let urlObj = window.URL || window.webkitURL;
    return urlObj.createObjectURL(src);
}
export function toDataURL(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var reader = new FileReader();
        reader.onloadend = function () {
            callback(reader.result);
        };
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}
