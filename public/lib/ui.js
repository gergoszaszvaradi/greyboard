import Delegate from "./delegate.js";
import { socket, board } from "./app.js";
export class UI {
    constructor() {
        this.onaction = new Delegate();
        this.hintRemoved = false;
        this.inputFocused = false;
        jQuery(() => {
            $(document).on("click", (e) => {
                if (e.target) {
                    let action = $(e.target).data("action");
                    if (action)
                        this.onaction.invoke(action, e.target);
                }
            });
            $(document).on("mousedown wheel", () => this.removeStartingHint());
            $("input").on("focus", () => this.inputFocused = true);
            $("input").on("blur keydown", e => {
                if (e.type == "keydown" && e.key != "Enter")
                    return;
                this.inputFocused = false;
            });
            $("#board-static-name").on("click", () => {
                $("#board-static-name").hide();
                $("#board-name").show().focus().select();
            });
            $("#board-name").on("blur keydown", (e) => {
                if (e.type == "keydown" && e.key != "Enter")
                    return;
                board.setName($("#board-name").val());
                $("#board-static-name").show();
                $("#board-name").hide();
                socket.send("board:name", board.name);
            });
        });
    }
    addUserPresence(client) {
        let abr = client.name.replace(/[^A-Z]/g, "");
        $("#users").append(`<div class="toolbar-button" data-action="pan-to-user" data-user="${client.cid}"><div class="toolbar-user">${abr}</div><div class="toolbar-button-tooltip bottom">${client.name}</div></div>`);
    }
    removeUserPresence(cid) {
        $(`.toolbar-button[data-user="${cid}"]`).remove();
    }
    setUserPresenceAFKState(cid, state) {
        if (state)
            $(`.toolbar-button[data-user="${cid}"]`).addClass("afk");
        else
            $(`.toolbar-button[data-user="${cid}"]`).removeClass("afk");
    }
    setToolbarButtonIcon(action, icon) {
        $(`.toolbar-button[data-action="${action}"] > i`).attr("class", `mdi ${icon}`);
    }
    setToolActive(tool) {
        $(".toolbar-button[data-action^=tool-]").removeClass("active");
        $(`.toolbar-button[data-action="tool-${tool}"]`).addClass("active");
    }
    setColorActive(color) {
        $(`.toolbar-button[data-action="set-color"]`).removeClass("active");
        $(`.toolbar-button[data-color="${color}"]`).addClass("active");
    }
    setZoomLevelPercentage(value) {
        $("#zoomlevel").text(`${Math.floor(value * 100)}%`);
    }
    setText(selector, text) {
        $(selector).text(text);
    }
    setTemporaryText(selector, text, time = 1000) {
        let original = $(selector).text();
        $(selector).text(text);
        setTimeout(() => {
            $(selector).text(original);
        }, time);
    }
    removeStartingHint() {
        if (this.hintRemoved == false) {
            $(".start-hint").fadeOut();
            this.hintRemoved = true;
        }
    }
}
