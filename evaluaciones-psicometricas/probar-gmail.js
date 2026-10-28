import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

try {
    const info = await transporter.sendMail({
        from: `"VALANTI" <${process.env.GMAIL_USER}>`,
        to: "psicomovid@gmail.com",
        subject: "Prueba de correo VALANTI",
        text: "Prueba de envío del sistema VALANTI. Si recibes este correo, la conexión con Gmail funciona correctamente."
    });

    console.log("CORREO ENVIADO CORRECTAMENTE");
    console.log("ID:", info.messageId);
} catch (error) {
    console.error("ERROR AL ENVIAR CORREO:");
    console.error(error);
    process.exit(1);
}
