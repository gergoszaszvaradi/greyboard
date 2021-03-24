export class Point {
    x : number;
    y : number;

    constructor(x : number = 0, y : number = 0){
        this.x = x;
        this.y = y;
    }
}
export class Rect {
    x : number;
    y : number;
    w : number;
    h : number;

    constructor(x : number = 0, y : number = 0, w : number = 0, h : number = 0){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
}

export class ERect extends Rect {
    ox : number;
    oy : number;

    constructor(x : number = 0, y : number = 0, w : number = 0, h : number = 0, ox : number = 0, oy : number = 0){
        super(x, y, w, h);
        this.ox = ox;
        this.oy = oy;
    }
}

export function inRange(x : number, min : number, max : number) : boolean {
    return (x >= min && x <= max);
}
export function angle(x1 : number, y1 : number, x2 : number, y2 : number) : number {
    let a = Math.atan2(y1-y2, x2-x1) * 180 / Math.PI;
    return (a < 0) ? 360+a : a;
}

export function lerp(a : number, b : number, t : number) : number {
    return a + t * (b - a);
}

export function quadLerp(a : number, b : number, c : number, t : number) : number {
    let p0 = lerp(a, b, t);
    let p1 = lerp(b, c, t);
    return lerp(p0, p1, t);
}

export function lineIntersection(x1 : number, y1 : number, x2 : number, y2 : number, x3 : number, y3 : number, x4 : number, y4 : number){
    let n = ((x1-x2) * (y3-y4) - (y1-y2) * (x3-x4))
    let t = ((x1-x3) * (y3-y4) - (y1-y3) * (x3-x4)) / n;
    let u = ((x1-x2) * (y1-y3) - (y1-y2) * (x1-x3)) / n;

    return ((t >= 0 && t <= 1) && (u >= -1 && u <= 0));
}
export function rectIntersection(x1 : number, y1 : number, w1 : number, h1 : number, x2 : number, y2 : number, w2 : number, h2 : number){
    return (!(x2 > x1+w1 || x2+w2 < x1 || y2 > y1+h1 || y2+h2 < y1));
}
export function isPointInRect(px : number, py : number, x : number, y : number, w : number, h : number){
    return (px > x && px < x+w && py > y && py < y+h);
}
export function isLineInRect(lx1 : number, ly1 : number, lx2 : number, ly2 : number, x : number, y : number, w : number, h : number){
    return (isPointInRect(lx1, ly1, x, y, w, h) || isPointInRect(lx2, ly2, x, y, w, h));
}

export function dist(x1 : number, y1 : number, x2 : number, y2 : number) : number {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}
export function distSq(x1 : number, y1 : number, x2 : number, y2 : number) : number {
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
}

export function generateID(n : number = 16) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for(let i = 0; i < n; i++)
        id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

export function toUrlObj(src : any){
    let urlObj = window.URL || window.webkitURL;
    return urlObj.createObjectURL(src);
}
export function toDataURL(url : string, callback : (x : string | ArrayBuffer | null) => void) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        var reader = new FileReader();
        reader.onloadend = function() {
            callback(reader.result);
        }
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}

export function hexToRgb(hex : string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}