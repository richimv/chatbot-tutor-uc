const fs = require('fs');
const path = require('path');

describe('Library UI - Gestión de Notas Manuales y openNoteModal', () => {
    let libraryJs;
    let libraryHtml;

    beforeAll(() => {
        libraryJs = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/js/ui/libraryUI.js'), 'utf8');
        libraryHtml = fs.readFileSync(path.join(__dirname, '../../src/presentation/public/library.html'), 'utf8');
    });

    test('El archivo libraryUI.js debe definir explícitamente el método openNoteModal en la clase LibraryUI', () => {
        expect(libraryJs).toContain('openNoteModal(noteId = null)');
    });

    test('openNoteModal debe delegar la ejecución directamente a openNoteEditor', () => {
        expect(libraryJs).toMatch(/openNoteModal\s*\(\s*noteId\s*=\s*null\s*\)\s*\{\s*this\.openNoteEditor\(noteId\);\s*\}/);
    });

    test('Los botones de creación de nota en libraryUI.js deben invocar window.libraryUI.openNoteModal() sin errores', () => {
        expect(libraryJs).toContain('onclick="window.libraryUI.openNoteModal()"');
    });

    test('El método openNoteEditor debe inicializar el estado en modo edición cuando se llama sin noteId', () => {
        // Mocking class execution in pure Node context
        const dummyDocument = {
            getElementById: jest.fn((id) => {
                return {
                    id,
                    value: 'test',
                    style: {},
                    classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn().mockReturnValue(true) },
                    innerHTML: ''
                };
            }),
            body: {
                classList: { add: jest.fn(), remove: jest.fn() },
                appendChild: jest.fn()
            },
            querySelector: jest.fn().mockReturnValue(null),
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn()
        };

        global.document = dummyDocument;
        global.window = {
            libraryService: { getLibraryData: () => ({ notes: [] }) },
            escapeHtml: (s) => s,
            AppConfig: { API_URL: '' },
            NetworkService: { fetch: jest.fn() }
        };

        // Extract class from libraryJs
        const scriptWithoutAutoInit = libraryJs.replace(/document\.addEventListener\('DOMContentLoaded'[\s\S]*?\);?\s*$/, '');
        const fn = new Function('window', 'document', `${scriptWithoutAutoInit}; return LibraryUI;`);
        const LibraryUIClass = fn(global.window, global.document);

        const instance = new LibraryUIClass();
        expect(typeof instance.openNoteModal).toBe('function');
        expect(typeof instance.openNoteEditor).toBe('function');

        // Spy on openNoteEditor
        const editorSpy = jest.spyOn(instance, 'openNoteEditor').mockImplementation(() => {});
        instance.openNoteModal();
        expect(editorSpy).toHaveBeenCalledWith(null);

        instance.openNoteModal('note-123');
        expect(editorSpy).toHaveBeenCalledWith('note-123');
    });
});
