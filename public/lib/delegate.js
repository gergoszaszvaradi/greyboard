export default class Delegate {
    constructor() {
        this.functions = [];
    }
    add(func) {
        this.functions.push(func);
    }
    invoke(...args) {
        for (let func of this.functions)
            func(...args);
    }
}
