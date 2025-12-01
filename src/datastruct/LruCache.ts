import DoublyLinkable from '#/datastruct/DoublyLinkable.js';
import HashTable from '#/datastruct/HashTable.js';
import DoublyLinkList from '#/datastruct/DoublyLinkList.js';

export default class LruCache {
    readonly capacity: number;
    readonly table: HashTable = new HashTable(1024);
    readonly history: DoublyLinkList = new DoublyLinkList();
    available: number;

    constructor(size: number) {
        this.capacity = size;
        this.available = size;
    }

    get(key: bigint): DoublyLinkable | null {
        const node: DoublyLinkable | null = this.table.get(key) as DoublyLinkable | null;
        if (node) {
            this.history.push(node);
        }
        return node;
    }

    put(key: bigint, value: DoublyLinkable): void {
        if (this.available === 0) {
            const node: DoublyLinkable | null = this.history.pop();
            node?.unlink();
            node?.unlink2();
        } else {
            this.available--;
        }
        this.table.put(key, value);
        this.history.push(value);
    }

    clear(): void {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const node: DoublyLinkable | null = this.history.pop();
            if (!node) {
                this.available = this.capacity;
                return;
            }
            node.unlink();
            node.unlink2();
        }
    }
}
