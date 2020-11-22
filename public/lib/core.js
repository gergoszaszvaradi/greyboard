import Delegate from "./delegate.js";
import Graphics from "./graphics.js";
import { UI } from "./ui.js";
export class Mouse {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.px = 0;
        this.py = 0;
        this.dx = 0;
        this.dy = 0;
        this.button = -1;
        this.pressed = false;
    }
}
export class Keyboard {
    constructor() {
        this.key = 0;
        this.ctrl = false;
        this.shift = false;
        this.alt = false;
        this.pressed = false;
    }
}
export class Application {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.mouse = new Mouse();
        this.keyboard = new Keyboard();
        this.shortcuts = [];
        this.onresize = new Delegate();
        this.onmousedown = new Delegate();
        this.onmousemove = new Delegate();
        this.onmouseup = new Delegate();
        this.onmousewheel = new Delegate();
        this.oncopy = new Delegate();
        this.onpaste = new Delegate();
        this.onupdate = new Delegate();
        this.ui = new UI();
        let canvas = document.getElementById("canvas");
        this.graphics = new Graphics(canvas);
        createjs.Ticker.timingMode = createjs.Ticker.RAF;
        this.resize(window.innerWidth, window.innerHeight);
        window.addEventListener("resize", () => {
            this.resize(window.innerWidth, window.innerHeight);
            this.onresize.invoke(this.width, this.height);
        });
        window.addEventListener("keydown", (e) => {
            this.keyboard.key = e.keyCode;
            this.keyboard.pressed = true;
            this.keyboard.ctrl = e.ctrlKey;
            this.keyboard.shift = e.shiftKey;
            this.keyboard.alt = e.altKey;
        });
        window.addEventListener("keyup", (e) => {
            for (let shortcut of this.shortcuts)
                if (e.ctrlKey == shortcut.ctrl && e.shiftKey == shortcut.shift && e.altKey == shortcut.alt && e.keyCode == shortcut.key)
                    shortcut.callback();
            this.keyboard = new Keyboard();
        });
        window.addEventListener("copy", (e) => {
            this.oncopy.invoke(e.clipboardData);
        });
        window.addEventListener("paste", (e) => {
            this.onpaste.invoke(e.clipboardData);
        });
        this.graphics.canvas.addEventListener("mousedown", (e) => {
            this.mouse.dx = e.clientX;
            this.mouse.dy = e.clientY;
            this.mouse.button = e.button;
            this.mouse.pressed = true;
            this.onmousedown.invoke(e.button, e.clientX, e.clientY);
        });
        this.graphics.canvas.addEventListener("mousemove", (e) => {
            this.mouse.px = this.mouse.x;
            this.mouse.py = this.mouse.y;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.onmousemove.invoke(e.clientX, e.clientY);
        });
        this.graphics.canvas.addEventListener("mouseup", (e) => {
            this.mouse.pressed = false;
            this.mouse.button = -1;
            this.onmouseup.invoke(e.clientX, e.clientY);
        });
        this.graphics.canvas.addEventListener("wheel", (e) => {
            this.onmousewheel.invoke(e.deltaX, e.deltaY);
        });
        this.lastUpdateTime = (new Date()).getTime();
        this.update();
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
        this.graphics.resize(w, h);
    }
    update() {
        window.requestAnimationFrame(() => {
            let now = (new Date()).getTime();
            let ts = (now - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = now;
            this.onupdate.invoke(ts);
            this.update();
        });
    }
    registerShortcut(key, ctrl, shift, alt, callback) {
        this.shortcuts.push({ key, ctrl, shift, alt, callback });
    }
    setCursor(cursor) {
        document.body.style.cursor = cursor;
    }
}
