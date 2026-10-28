import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
    from: "VALANTI <onboarding@resend.dev>",
    to: ["psicomovid@gmail.com"],
    subject: "Prueba de envío VALANTI",
    text: "Este es un correo de prueba del sistema VALANTI. Si recibes este mensaje, el envío de correo está funcionando correctamente."
});

if (error) {
    console.error("ERROR AL ENVIAR:");
    console.error(error);
    process.exit(1);
}

console.log("CORREO ENVIADO CORRECTAMENTE:");
console.log(data);
