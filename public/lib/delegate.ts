export default class Delegate {
    functions : Array<(...args : any[]) => void> = [];

    add(func : (...args : any[]) => void) {
        this.functions.push(func);
    }

    invoke(...args : any[]) {
        for(let func of this.functions)
            func(...args);
    }
}