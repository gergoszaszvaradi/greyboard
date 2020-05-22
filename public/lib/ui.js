import Delegate from "./delegate.js";
import { app, toolbox, socket, board } from "./app.js";
export class UI {
    constructor() {
        this.onaction = new Delegate();
        this.dragInfo = { e: null, dx: 0, dy: 0 };
        document.addEventListener("DOMContentLoaded", () => {
            document.addEventListener("mousemove", (e) => {
                if (this.dragInfo && this.dragInfo.e) {
                    let x = e.clientX - this.dragInfo.dx;
                    let y = e.clientY - this.dragInfo.dy;
                    if (x > 20 && this.dragInfo.e.clientWidth + x < window.innerWidth - 20)
                        this.dragInfo.e.style.left = `${x}px`;
                    if (y > 20 && this.dragInfo.e.clientHeight + y < window.innerHeight - 20)
                        this.dragInfo.e.style.top = `${y}px`;
                }
            });
            document.addEventListener("mouseup", (e) => {
                if (this.dragInfo) {
                    this.dragInfo = { e: null, dx: 0, dy: 0 };
                    app.setCursor("default");
                }
            });
            document.querySelectorAll("*[action]").forEach((e) => {
                e.addEventListener("click", () => {
                    let action = e.getAttribute("action");
                    if (action)
                        this.onaction.invoke(action, e);
                });
            });
            document.querySelectorAll(".panel .button").forEach((e) => {
                e.addEventListener("mousedown", () => {
                    e.classList.add("ripple");
                    setTimeout(() => { e.classList.remove("ripple"); }, 500);
                });
            });
            document.querySelectorAll(".toolbar #grab").forEach((e) => {
                e.addEventListener("mousedown", (event) => {
                    if (e.parentElement) {
                        let style = window.getComputedStyle(e.parentElement);
                        this.dragInfo = {
                            e: e.parentElement,
                            dx: event.clientX - parseInt(style.left),
                            dy: event.clientY - parseInt(style.top)
                        };
                        app.setCursor("move");
                    }
                });
            });
            document.querySelectorAll("#board-static-name").forEach((e) => {
                e.addEventListener("click", () => {
                    e.style.display = "none";
                    let input = document.querySelector("#board-name");
                    input.style.display = "block";
                    input.focus();
                    input.select();
                });
            });
            document.querySelector("#board-name").addEventListener("blur", (e) => {
                e.currentTarget.style.display = "none";
                let text = document.querySelector("#board-static-name");
                text.innerHTML = e.currentTarget.value;
                text.style.display = "block";
                board.name = text.innerHTML;
                socket.send("board:name", board.name);
            });
            document.querySelector("#board-name").addEventListener("keydown", (e) => {
                if (e.keyCode != 13)
                    return;
                e.currentTarget.style.display = "none";
                let text = document.querySelector("#board-static-name");
                text.innerHTML = e.currentTarget.value;
                text.style.display = "block";
                board.name = text.innerHTML;
                socket.send("board:name", board.name);
            });
            document.querySelector("#stroke-size").addEventListener("change", (e) => {
                toolbox.weight = e.currentTarget.valueAsNumber;
            });
        });
    }
    setText(selector, text) {
        let e = document.querySelector(selector);
        if (e == null)
            return;
        e.innerHTML = text;
    }
    setActive(all, e) {
        document.querySelectorAll(all).forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(e).forEach((t) => t.classList.add("active"));
    }
}
