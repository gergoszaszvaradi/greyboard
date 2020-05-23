import Delegate from "./delegate.js";
import { app, toolbox, socket, board } from "./app.js";
export class UI {
    constructor() {
        this.onaction = new Delegate();
        this.dragInfo = { e: null, dx: 0, dy: 0 };
        $(document).ready(() => {
            $(document).on("mousemove", (e) => {
                if (this.dragInfo && this.dragInfo.e) {
                    let x = e.clientX - this.dragInfo.dx;
                    let y = e.clientY - this.dragInfo.dy;
                    if (x > 20 && this.dragInfo.e.clientWidth + x < window.innerWidth - 20)
                        this.dragInfo.e.style.left = `${x}px`;
                    if (y > 20 && this.dragInfo.e.clientHeight + y < window.innerHeight - 20)
                        this.dragInfo.e.style.top = `${y}px`;
                }
            });
            $(document).on("mouseup", (e) => {
                if (this.dragInfo) {
                    this.dragInfo = { e: null, dx: 0, dy: 0 };
                    app.setCursor("default");
                }
            });
            $("*[action]").on("click", (e) => {
                let action = $(e.currentTarget).attr("action");
                if (action)
                    this.onaction.invoke(action, e.currentTarget);
            });
            $(".panel .button").on("mousedown", (e) => {
                $(e.currentTarget).addClass("ripple");
                setTimeout(() => { $(e.currentTarget).removeClass("ripple"); }, 500);
            });
            $(".toolbar #grab").on("mousedown", (e) => {
                let parent = $(e.currentTarget).parent();
                if (parent) {
                    this.dragInfo = {
                        e: parent[0],
                        dx: e.clientX - parseInt(parent.css("left")),
                        dy: e.clientY - parseInt(parent.css("top"))
                    };
                    app.setCursor("move");
                }
            });
            $("#board-static-name").on("click", (e) => {
                $(e.currentTarget).hide();
                let input = $("#board-name");
                input.show();
                input.focus();
                input.select();
            });
            $("#board-name").on("blur", (e) => {
                $(e.currentTarget).hide();
                let text = $("#board-static-name");
                text.text($(e.currentTarget).val());
                text.show();
                board.name = text.text();
                document.title = `Greyboard | ${board.name}`;
                socket.send("board:name", board.name);
            });
            $("#board-name").on("keydown", (e) => {
                if (e.keyCode != 13)
                    return;
                $(e.currentTarget).hide();
                let text = $("#board-static-name");
                text.text($(e.currentTarget).val());
                text.show();
                board.name = text.text();
                document.title = `Greyboard | ${board.name}`;
                socket.send("board:name", board.name);
            });
            $("#stroke-size").on("change", (e) => {
                toolbox.weight = $(e.currentTarget).val();
            });
        });
    }
    setText(selector, text) {
        $(selector).text(text);
    }
    setActive(all, e) {
        $(all).removeClass("active");
        $(e).addClass("active");
    }
    showPanel(panel) {
        $(panel).fadeIn();
    }
    hideAllPanels() {
        $(".panel").fadeOut();
    }
}
