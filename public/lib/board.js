import * as Util from "./util.js";
import { viewport, app, socket, toolbox, board } from "./app.js";
import { ActionStack } from "./action.js";
import Delegate from "./delegate.js";
export var BoardItemType;
(function (BoardItemType) {
    BoardItemType[BoardItemType["None"] = 0] = "None";
    BoardItemType[BoardItemType["Path"] = 1] = "Path";
    BoardItemType[BoardItemType["Rectangle"] = 2] = "Rectangle";
    BoardItemType[BoardItemType["Ellipse"] = 3] = "Ellipse";
    BoardItemType[BoardItemType["Arrow"] = 4] = "Arrow";
    BoardItemType[BoardItemType["Image"] = 5] = "Image";
})(BoardItemType || (BoardItemType = {}));
;
export class Board {
    constructor() {
        this.name = "New board";
        this.items = {};
        this.public = false;
    }
    add(items) {
        for (let item of items)
            this.items[item.id] = item;
    }
    addFromObjects(objs) {
        let itemsToAdd = [];
        for (let item of objs) {
            if (item.type == BoardItemType.Path) {
                let path = new BoardPath(item.cid, item.points, item.color, item.weight);
                path.id = item.id;
                path.rect = item.rect;
                itemsToAdd.push(path);
            }
            else if (item.type == BoardItemType.Rectangle) {
                let rectangle = new BoardRectangle(item.cid, item.rect.x, item.rect.y, item.rect.w, item.rect.h, item.color, item.weight, item.filled);
                rectangle.id = item.id;
                itemsToAdd.push(rectangle);
            }
            else if (item.type == BoardItemType.Ellipse) {
                let ellipse = new BoardEllipse(item.cid, item.rect.x, item.rect.y, item.rect.w, item.rect.h, item.color, item.weight, item.filled);
                ellipse.id = item.id;
                itemsToAdd.push(ellipse);
            }
            else if (item.type == BoardItemType.Arrow) {
                let arrow = new BoardArrow(item.cid, item.start.x, item.start.y, item.end.x, item.end.y, item.color, item.weight);
                arrow.id = item.id;
                arrow.rect = item.rect;
                itemsToAdd.push(arrow);
            }
            else if (item.type == BoardItemType.Image) {
                let img = new BoardImage(item.cid, item.rect.x, item.rect.y, item.src);
                img.id = item.id;
                img.onloaded.add(() => {
                    img.rect.w = item.rect.w;
                    img.rect.h = item.rect.h;
                });
                itemsToAdd.push(img);
            }
        }
        this.add(itemsToAdd);
    }
    addFromClipboard(data) {
        if (data == null)
            return;
        if (data.items.length == 0)
            return;
        let item = data.items[0];
        if (item.type.startsWith("text")) {
            let items = JSON.parse(data.getData("text"));
            if (items) {
                toolbox.selectTool(toolbox.select);
                toolbox.select.clearSelection();
                let ids = [];
                for (let i of items) {
                    i.id = Util.generateID();
                    i.rect.x += 30;
                    i.rect.y += 30;
                    ids.push(i.id);
                }
                navigator.clipboard.writeText(JSON.stringify(items));
                ActionStack.add((data) => {
                    this.addFromObjects(data.items);
                    toolbox.select.selection = data.ids;
                    toolbox.select.calculateBoundingBox();
                    socket.send("board:add", data.items);
                }, (data) => {
                    this.remove(data.ids);
                    socket.send("board:remove", data.ids);
                }, { items, ids });
                board.addFromObjects(items);
                toolbox.select.selection = ids;
                toolbox.select.calculateBoundingBox();
            }
        }
        else if (item.type.startsWith("image")) {
            let blob = item.getAsFile();
            Util.toDataURL(Util.toUrlObj(blob), (b64) => {
                let topleft = viewport.screenToViewport(0, 0);
                let bottomright = viewport.screenToViewport(window.innerWidth, window.innerHeight);
                let img = new BoardImage(socket.cid, (topleft.x + bottomright.x) / 2, (topleft.y + bottomright.y) / 2, b64);
                img.onloaded.add(() => {
                    ActionStack.add((data) => {
                        this.add([img]);
                        socket.send("board:add", [img]);
                    }, (data) => {
                        this.remove([img.id]);
                        socket.send("board:remove", [img.id]);
                    }, img);
                });
            });
        }
    }
    move(ids, dx, dy) {
        for (let id of ids) {
            let item = this.items[id];
            item.rect.x -= dx;
            item.rect.y -= dy;
        }
    }
    scale(ids, dx, dy) {
        let bb = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
        for (let i of ids) {
            let item = this.items[i];
            if (item.rect.x < bb.x)
                bb.x = item.rect.x;
            if (item.rect.x + item.rect.w > bb.w)
                bb.w = item.rect.x + item.rect.w;
            if (item.rect.y < bb.y)
                bb.y = item.rect.y;
            if (item.rect.y + item.rect.h > bb.h)
                bb.h = item.rect.y + item.rect.h;
        }
        bb.w -= bb.x;
        bb.h -= bb.y;
        for (let id of ids) {
            let item = this.items[id];
            item.rect.x -= ((item.rect.x - bb.x) / bb.w) * dx;
            item.rect.y -= ((item.rect.y - bb.y) / bb.h) * dy;
            item.rect.w -= (item.rect.w / bb.w) * dx;
            item.rect.h -= (item.rect.h / bb.h) * dy;
        }
    }
    remove(ids) {
        for (let id of ids)
            delete this.items[id];
    }
    clear() {
        for (let id in this.items) {
            delete this.items[id];
        }
    }
    each(func) {
        for (let item in this.items)
            func(this.items[item]);
    }
    draw() {
        for (let i in this.items)
            if (viewport.isRectInView(this.items[i].rect))
                this.items[i].draw();
    }
    drawAll() {
        for (let i in this.items)
            this.items[i].draw();
    }
    getBoundingBox() {
        let rr = new Util.Rect(Infinity, Infinity, -Infinity, -Infinity);
        for (let i in this.items) {
            let r = this.items[i].rect;
            if (rr.x > r.x)
                rr.x = r.x;
            if (rr.y > r.y)
                rr.y = r.y;
            if (rr.w < r.x + r.w)
                rr.w = r.x + r.w;
            if (rr.h < r.y + r.h)
                rr.h = r.y + r.h;
        }
        rr.w -= rr.x;
        rr.h -= rr.y;
        return rr;
    }
    setName(name) {
        this.name = name;
        document.title = `Greyboard | ${name}`;
        app.ui.setText("#board-static-name", name);
    }
}
export class BoardItem {
    constructor(cid, x = 0, y = 0, w = 0, h = 0) {
        this.cid = cid;
        this.rect = new Util.Rect(x, y, w, h);
        this.id = Util.generateID();
        this.type = BoardItemType.None;
    }
    isInRect(rect) { return false; }
    ;
    isInLine(x1, y1, x2, y2) { return false; }
    ;
    draw() { }
    ;
}
export class BoardPath extends BoardItem {
    constructor(cid, points, color, weight) {
        super(cid);
        this.color = "#ffffff";
        this.weight = 2;
        this.color = color;
        this.weight = weight;
        this.type = BoardItemType.Path;
        this.rect.x = Infinity;
        this.rect.y = Infinity;
        this.rect.w = -Infinity;
        this.rect.h = -Infinity;
        this.points = points;
    }
    normalize() {
        for (let point of this.points) {
            point.x = (point.x - this.rect.x) / this.rect.w;
            point.y = (point.y - this.rect.y) / this.rect.h;
        }
    }
    optimize() {
        let points = [];
        points.push(this.points[this.points.length - 1]);
        for (let i = this.points.length - 2; i >= 2; i--) {
            let next = this.points[i];
            let curr = this.points[i - 1];
            let prev = this.points[i - 2];
            let dist = (next.x - prev.x) * (next.x - prev.x) + (next.y - prev.y) * (next.y - prev.y);
            if (dist > 9) {
                let a1 = Util.angle(prev.x, prev.y, curr.x, curr.y);
                let a2 = Util.angle(curr.x, curr.y, next.x, next.y);
                if (Math.abs(a1 - a2) < 3)
                    continue;
            }
            points.push(this.points[i]);
        }
        points.push(this.points[0]);
        this.points = points;
    }
    calculateRect() {
        for (let point of this.points) {
            if (point.x < this.rect.x)
                this.rect.x = point.x;
            if (point.x > this.rect.w)
                this.rect.w = point.x;
            if (point.y < this.rect.y)
                this.rect.y = point.y;
            if (point.y > this.rect.h)
                this.rect.h = point.y;
        }
        this.rect.w -= this.rect.x;
        this.rect.h -= this.rect.y;
        if (this.rect.w == 0)
            this.rect.w = 1;
        if (this.rect.h == 0)
            this.rect.h = 1;
    }
    isInRect(rect) {
        for (let p of this.points) {
            if (Util.isPointInRect(p.x * this.rect.w + this.rect.x, p.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h)) {
                return true;
            }
        }
        return false;
    }
    isInLine(x1, y1, x2, y2) {
        for (let i = 1; i < this.points.length; i++) {
            if (Util.lineIntersection(x1, y1, x2, y2, this.points[i].x * this.rect.w + this.rect.x, this.points[i].y * this.rect.h + this.rect.y, this.points[i - 1].x * this.rect.w + this.rect.x, this.points[i - 1].y * this.rect.h + this.rect.y)) {
                return true;
            }
        }
        return false;
    }
    draw() {
        app.graphics.stroke(this.color, this.weight);
        app.graphics.path(this.points, this.rect);
    }
}
export class BoardRectangle extends BoardItem {
    constructor(cid, x, y, w, h, color, weight, filled = false) {
        super(cid, x, y, w, h);
        this.color = "#ffffff";
        this.weight = 2;
        this.color = color;
        this.weight = weight;
        this.filled = filled;
        this.type = BoardItemType.Rectangle;
    }
    isInRect(rect) {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1, y1, x2, y2) {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }
    draw() {
        if (this.filled) {
            app.graphics.fill(this.color);
            app.graphics.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        }
        else {
            app.graphics.stroke(this.color, this.weight);
            app.graphics.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        }
    }
}
export class BoardEllipse extends BoardItem {
    constructor(cid, x, y, w, h, color, weight, filled = false) {
        super(cid, x, y, w, h);
        this.color = "#ffffff";
        this.weight = 2;
        this.color = color;
        this.weight = weight;
        this.filled = filled;
        this.type = BoardItemType.Ellipse;
    }
    isInRect(rect) {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1, y1, x2, y2) {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }
    draw() {
        if (this.filled) {
            app.graphics.fill(this.color);
            app.graphics.fillEllipse(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2, this.rect.w / 2, this.rect.h / 2);
        }
        else {
            app.graphics.stroke(this.color, this.weight);
            app.graphics.ellipse(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2, this.rect.w / 2, this.rect.h / 2);
        }
    }
}
export class BoardImage extends BoardItem {
    constructor(cid, x = 0, y = 0, src) {
        super(cid, x, y, 0, 0);
        this.loaded = false;
        this.onloaded = new Delegate();
        this.img = new Image();
        this.src = src;
        this.img.src = src;
        this.img.onload = () => {
            this.rect.w = this.img.width;
            this.rect.h = this.img.height;
            this.loaded = true;
            this.onloaded.invoke();
        };
        this.type = BoardItemType.Image;
    }
    isInRect(rect) {
        return Util.rectIntersection(this.rect.x, this.rect.y, this.rect.w, this.rect.h, rect.x, rect.y, rect.w, rect.h);
    }
    isInLine(x1, y1, x2, y2) {
        return Util.isLineInRect(x1, y1, x2, y2, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    }
    draw() {
        if (!this.loaded)
            return;
        app.graphics.img(this.rect.x, this.rect.y, this.rect.w, this.rect.h, this.img);
    }
}
export class BoardArrow extends BoardItem {
    constructor(cid, x1 = 0, y1 = 0, x2 = 0, y2 = 0, color, weight) {
        super(cid, x1, y1, x2 - x1, y2 - y1);
        this.color = "#ffffff";
        this.weight = 2;
        this.start = new Util.Point(x1, y1);
        this.end = new Util.Point(x2, y2);
        this.color = color;
        this.weight = weight;
        this.type = BoardItemType.Arrow;
    }
    normalize() {
        this.start = new Util.Point((this.start.x - this.rect.x) / this.rect.w, (this.start.y - this.rect.y) / this.rect.h);
        this.end = new Util.Point((this.end.x - this.rect.x) / this.rect.w, (this.end.y - this.rect.y) / this.rect.h);
    }
    calculateRect() {
        this.rect.x = (this.start.x < this.end.x) ? this.start.x : this.end.x;
        this.rect.w = Math.abs(this.end.x - this.start.x);
        this.rect.y = (this.start.y < this.end.y) ? this.start.y : this.end.y;
        this.rect.h = Math.abs(this.end.y - this.start.y);
    }
    isInRect(rect) {
        return (Util.isPointInRect(this.start.x * this.rect.w + this.rect.x, this.start.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h) ||
            Util.isPointInRect(this.end.x * this.rect.w + this.rect.x, this.end.y * this.rect.h + this.rect.y, rect.x, rect.y, rect.w, rect.h));
    }
    isInLine(x1, y1, x2, y2) {
        return Util.lineIntersection(this.start.x * this.rect.w + this.rect.x, this.start.y * this.rect.h + this.rect.y, this.end.x * this.rect.w + this.rect.x, this.end.y * this.rect.h + this.rect.y, x1, y1, x2, y2);
    }
    draw() {
        let sx = this.start.x * this.rect.w + this.rect.x;
        let sy = this.start.y * this.rect.h + this.rect.y;
        let ex = this.end.x * this.rect.w + this.rect.x;
        let ey = this.end.y * this.rect.h + this.rect.y;
        app.graphics.stroke(this.color, this.weight);
        app.graphics.line(sx, sy, ex, ey);
        app.graphics.fill(this.color);
        let angle = Math.atan2(ey - sy, ex - sx);
        let tx1 = Math.cos(angle + Math.PI * 0.8) * this.weight * 3 + ex;
        let tx2 = Math.cos(angle - Math.PI * 0.8) * this.weight * 3 + ex;
        let ty1 = Math.sin(angle + Math.PI * 0.8) * this.weight * 3 + ey;
        let ty2 = Math.sin(angle - Math.PI * 0.8) * this.weight * 3 + ey;
        app.graphics.line(tx1, ty1, ex, ey);
        app.graphics.line(tx2, ty2, ex, ey);
    }
    ;
}
