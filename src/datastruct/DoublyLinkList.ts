import DoublyLinkable from '#/datastruct/DoublyLinkable.js';

export default class DoublyLinkList<T extends DoublyLinkable> {
    readonly sentinel: DoublyLinkable = new DoublyLinkable();
    cursor: DoublyLinkable | null = null;

    constructor() {
        this.sentinel.next2 = this.sentinel;
        this.sentinel.prev2 = this.sentinel;
    }

    push(node: T): void {
        if (node.prev2) {
            node.unlink2();
        }

        node.prev2 = this.sentinel.prev2;
        node.next2 = this.sentinel;
        if (node.prev2) {
            node.prev2.next2 = node;
        }
        node.next2.prev2 = node;
    }

    pop(): T | null {
        const node: T | null = this.sentinel.next2 as T | null;
        if (node === this.sentinel) {
            return null;
        } else {
            node?.unlink2();
            return node;
        }
    }

    head() {
        const node: T | null = this.sentinel.next2 as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }

        this.cursor = node?.next2 ?? null;
        return node;
    }

    next() {
        const node: T | null = this.cursor as T | null;
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        }

        this.cursor = node?.next2 ?? null;
        return node;
    }

    size() {
        let count = 0;
        for (let node = this.sentinel.next2; node !== this.sentinel && node; node = node.next2) {
            count++;
        }
        return count;
    }
}
