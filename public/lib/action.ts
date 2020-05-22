import Delegate from "./delegate.js";

export interface Action {
    execute : (...args : any[]) => void;
    revert : (...args : any[]) => void;
    data : any;
}

export class ActionStack {
    
    static undoStack : Array<Action> = [];
    static redoStack : Array<Action> = [];

    static onundo = new Delegate();
    static onredo = new Delegate();

    static add(execute : (...args : any[]) => void, revert : (...args : any[]) => void, data : any, exec : boolean = true) {
        if(this.undoStack.length > 100){
            this.undoStack.shift();
        }
        this.undoStack.push({execute, revert, data});
        if(exec)
            execute(data);

        this.redoStack = [];
    }

    static undo(){
        let action = this.undoStack.pop();
        if(action == null) return;
        action.revert(action.data);
        this.redoStack.push(action);
        this.onundo.invoke(action);
    }

    static redo(){
        let action = this.redoStack.pop();
        if(action == null) return;
        action.execute(action.data);
        this.undoStack.push(action);
        this.onredo.invoke(action);
    }
}