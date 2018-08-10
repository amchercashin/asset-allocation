async function maybeStore(index, indexData) {
    if (typeof (Storage) !== "undefined") {
        sessionStorage.setItem(index, JSON.stringify(indexData));
        return true;
    } else {
        return false;
    }

}

async function maybeGetFromStore(index) {
    if (typeof (sessionStorage.getItem(index)) !== "undefined") {
        return JSON.parse(sessionStorage.getItem(index));
    } else {
        return false;
    }
}