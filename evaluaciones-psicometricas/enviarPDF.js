import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

export async function enviarPDFPorCorreo(archivoPDF, participanteId, nombreParticipante) {
    const info = await transporter.sendMail({
        from: `"VALANTI" <${process.env.GMAIL_USER}>`,
        to: "psicomovid@gmail.com",
        subject: `Nuevo formulario VALANTI - Registro #${participanteId}`,
        text: [
            "Se ha recibido un nuevo cuestionario VALANTI.",
            "",
            `Registro: #${participanteId}`,
            `Participante: ${nombreParticipante}`,
            "",
            "Se adjunta el PDF actualizado con los participantes y sus respuestas."
        ].join("\n"),
        attachments: [
            {
                filename: "valanti_registros.pdf",
                path: archivoPDF,
                contentType: "application/pdf"
            }
        ]
    });

    console.log("PDF enviado correctamente por correo.");
    console.log("ID del correo:", info.messageId);

    return info;
}

export async function enviarDISCPorCorreo(archivoPDF, participanteId, nombreParticipante) {
    const info = await transporter.sendMail({
        from: `"PRUEBA DISC" <${process.env.GMAIL_USER}>`,
        to: "psicomovid@gmail.com",
        subject: `Nuevo resultado PRUEBA DISC - Registro #${participanteId}`,
        text: [
            "Se ha recibido una nueva prueba DISC.",
            "",
            `Registro: #${participanteId}`,
            `Participante: ${nombreParticipante}`,
            "",
            "Se adjunta el PDF de resultados DISC."
        ].join("\n"),
        attachments: [{
            filename: "disc_resultados.pdf",
            path: archivoPDF,
            contentType: "application/pdf"
        }]
    });

    console.log("PDF DISC enviado correctamente por correo.");
    console.log("ID del correo:", info.messageId);
    return info;
}

