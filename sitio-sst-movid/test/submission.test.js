import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { createSubmissionPdf, submissionPdfFilename, validateSubmission } from '../lib/submission.js';

const validInput = {
  committee: 'COPASST',
  name: 'María Pérez',
  document: '123456789',
  position: 'Fisioterapeuta',
  area: 'Rehabilitación',
  motivation: 'Quiero apoyar a mis compañeros.',
  consent: true,
};

test('valida y normaliza una postulación válida', () => {
  const result = validateSubmission({ ...validInput, document: '12.345.678-9' });
  assert.equal(result.error, undefined);
  assert.equal(result.submission.document, '123456789');
  assert.equal(result.submission.name, 'María Pérez');
});

test('rechaza comités, documentos y consentimientos no válidos', () => {
  assert.match(validateSubmission({ ...validInput, committee: 'Otro' }).error, /comité/i);
  assert.match(validateSubmission({ ...validInput, document: '12' }).error, /documento/i);
  assert.match(validateSubmission({ ...validInput, consent: false }).error, /aceptar/i);
  assert.match(validateSubmission({ ...validInput, motivation: '   ' }).error, /representar/i);
});

test('genera un PDF legible con contenido en español', async () => {
  const result = validateSubmission(validInput);
  const pdf = await createSubmissionPdf({
    id: '123e4567-e89b-42d3-a456-426614174000',
    ...result.submission,
    createdAt: '5 de octubre de 2026, 8:00 a. m.',
    consentAcceptedAt: '2026-10-05T13:00:00.000Z',
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1000);
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getTitle(), 'María Pérez');
  assert.match(submissionPdfFilename({
    id: '123e4567-e89b-42d3-a456-426614174000',
    name: 'María Pérez',
  }), /^Maria-Perez-123e4567-e89b-42d3-a456-426614174000\.pdf$/);
});

test('valida la hoja de vida y genera su PDF', async () => {
  const { createHojaVidaPdf, validateHojaVida } = await import('../lib/hojaVida.js');
  const input = {
    type: 'hoja-vida',
    consent: true,
    photo: '',
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    header: { nombres: 'María', apellidos: 'Pérez Gómez', docType: 'CC', document: '1.234.567', cargo: 'Fisioterapeuta', celular: '300 123 4567' },
    sections: [{ title: 'Formación académica', blocks: [{ type: 'table', cols: ['Nivel', 'Institución'], rows: [['Profesional', 'U. del Valle'], ['Técnico', '']] }] }],
  };
  assert.match(validateHojaVida({ ...input, consent: false }).error, /aceptar/i);
  assert.match(validateHojaVida({ ...input, signature: '' }).error, /firma/i);
  assert.match(validateHojaVida({ ...input, photo: 'data:image/png;base64,AAA' }).error, /foto/i);
  const { hojaVida, error } = validateHojaVida(input);
  assert.equal(error, undefined);
  assert.equal(hojaVida.name, 'María Pérez Gómez');
  assert.equal(hojaVida.document, '1234567');
  assert.equal(hojaVida.sections[0].blocks[0].rows.length, 2);
  const pdf = await createHojaVidaPdf({ ...hojaVida, id: '123e4567-e89b-42d3-a456-426614174000', createdAt: '6 de octubre de 2026, 9:00 a. m.' });
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getTitle(), 'Hoja de vida - María Pérez Gómez');
  assert.ok(document.getPageCount() <= 2);
  assert.match(submissionPdfFilename({ ...hojaVida, id: 'x' }), /^Hoja-de-vida-Maria-Perez-Gomez-x\.pdf$/);
});

test('valida HV y soportes y genera su índice', async () => {
  const { SLOTS, createSoportesIndexPdf, validateSoportes } = await import('../lib/soportes.js');
  const answers = SLOTS.filter((slot) => slot.rule === 'answer').map((slot) => slot.id);
  const input = {
    name: 'Ana Prueba', document: '123456', cargo: 'Auxiliar', consent: true,
    notApplicable: answers.filter((id) => id !== 'cedula'),
    files: [{ slot: 'hv', name: 'Mi HV.pdf', size: 2000 }, { slot: 'cedula', name: 'cedula.pdf', size: 3000 }],
  };
  assert.match(validateSoportes({ ...input, files: input.files.slice(1) }).error, /Hoja de vida personal/);
  assert.match(validateSoportes({ ...input, notApplicable: [] }).error, /No aplica/);
  assert.match(validateSoportes({ ...input, files: [...input.files, { slot: 'tarjeta', name: 'tarjeta.jpg', size: 10 }] }).error, /PDF/);
  assert.match(validateSoportes({ ...input, files: [...input.files, { slot: 'tarjeta', name: 'grande.pdf', size: 5 * 1024 * 1024 }] }).error, /4 MB/);
  const { soportes, error } = validateSoportes(input);
  assert.equal(error, undefined);
  assert.equal(soportes.files[0].path, '1-hv-Mi-HV.pdf');
  assert.ok(!soportes.notApplicable.includes('tarjeta'));
  const pdf = await createSoportesIndexPdf({ ...soportes, id: 'x', createdAt: '6 de octubre de 2026' });
  assert.equal((await PDFDocument.load(pdf)).getTitle(), 'HV y soportes - Ana Prueba');
});
