import Delegate from "./delegate.js";
let ActionStack = (() => {
    class ActionStack {
        static add(execute, revert, data, exec = true) {
            if (this.undoStack.length > 100) {
                this.undoStack.shift();
            }
            this.undoStack.push({ execute, revert, data });
            if (exec)
                execute(data);
            this.redoStack = [];
        }
        static undo() {
            let action = this.undoStack.pop();
            if (action == null)
                return;
            action.revert(action.data);
            this.redoStack.push(action);
            this.onundo.invoke(action);
        }
        static redo() {
            let action = this.redoStack.pop();
            if (action == null)
                return;
            action.execute(action.data);
            this.undoStack.push(action);
            this.onredo.invoke(action);
        }
    }
    ActionStack.undoStack = [];
    ActionStack.redoStack = [];
    ActionStack.onundo = new Delegate();
    ActionStack.onredo = new Delegate();
    return ActionStack;
})();
export { ActionStack };
