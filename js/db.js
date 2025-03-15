const db = (function () {
    const DB_NAME = 'NoteAppDB';
    const DB_VERSION = 1;
    let database;
    
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                database = e.target.result;
                if (!database.objectStoreNames.contains('notes')) {
                    database.createObjectStore('notes', { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains('reviewSchedule')) {
                    database.createObjectStore('reviewSchedule', { keyPath: 'noteId' });
                }
                if (!database.objectStoreNames.contains('performance')) {
                    database.createObjectStore('performance', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                database = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }
    
    async function saveNote(note) {
        await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction('notes', 'readwrite');
            tx.objectStore('notes').put(note);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }
    
    async function getNotes() {
        await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction('notes', 'readonly');
            const store = tx.objectStore('notes');
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }
    
    // Expose other db functions as needed
    
    return {
        saveNote,
        getNotes
    };
})();

// Added test function for db.js
function runDBTests() {
    console.log("Running db.js tests...");
    const dummyNote = {
        id: 111111,
        heading: "DB Test Note",
        content: "DB test content",
        reviewEnabled: false,
        createdAt: new Date(),
        connections: []
    };
    db.saveNote(dummyNote).then(() => {
        console.log("DB Test note saved.");
        return db.getNotes();
    }).then(notes => {
        let found = notes.find(n => n.id === 111111);
        console.log("DB Test note retrieval:", found ? "Success" : "Failure");
    }).catch(err => {
        console.error("Error in DB tests:", err);
    });
}
window.runDBTests = runDBTests;
