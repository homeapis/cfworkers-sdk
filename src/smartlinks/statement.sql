DROP TABLE IF EXISTS Smartlinks;
CREATE TABLE IF NOT EXISTS Smartlinks (id TEXT PRIMARY KEY, destination TEXT, shortId TEXT, createdAt INTEGER, updatedAt INTEGER, accountUid TEXT);
INSERT INTO Smartlinks (id, destination, shortId, createdAt, accountUid) VALUES (
    "6975d4d7b223",
    "https://stackoverflow.com/questions/58325771/how-to-generate-random-hex-string-in-javascript",
    "hexRand",
    1724161408314,
    "waad|entra|a6d0eca0-37f2-4a3c-8e6a-e3a8b69a426e"
);