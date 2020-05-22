"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const greyboard_js_1 = require("./greyboard.js");
const PORT = process.env.PORT || 5000;
let app = express_1.default();
let server = http_1.default.createServer(app);
let greyboard;
app.use(express_1.default.static("public"));
app.set("views", "public");
app.set("view engine", "ejs");
app.use(express_fileupload_1.default({
    safeFileNames: true,
    useTempFiles: true,
    tempFileDir: './tmp/',
    limits: { fileSize: 1000000 },
    abortOnLimit: true
}));
app.get("/", (req, res) => {
    res.render("index");
});
app.get("/new", (req, res) => {
    let id = greyboard.createTemporaryBoard();
    res.redirect(301, `/b/${id}`);
    res.end();
});
app.post("/load", (req, res) => {
    greyboard.loadFromFile(req.files.file.tempFilePath, (err, bid) => {
        if (err) {
            res.send(err.message);
            res.end();
            return;
        }
        res.send(bid);
        res.end();
    });
});
app.get("/b/:id", (req, res) => {
    if (greyboard.boardExists(req.params.id)) {
        res.render("board", { board: { id: req.params.id, name: "New Board" } });
    }
    res.end();
});
app.get("/b/:id/save", (req, res) => {
    if (greyboard.boardExists(req.params.id)) {
        res.setHeader('Content-disposition', `attachment; filename=board_${req.params.id}.json`);
        res.setHeader('Content-Type', 'text/json');
        greyboard.writeToResponse(res, req.params.id);
    }
    else {
        res.send("Board does not exist");
    }
    res.end();
});
server.listen(PORT);
server.on("listening", () => {
    console.log("Listening on " + PORT);
    greyboard = new greyboard_js_1.GreyBoard(server);
});
