import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// Solo procesa el envío, no responde al navegador
export const sendMailHelper = async (data) => {
  const { name, email, message } = data;
  
  return await transporter.sendMail({
    from: `"TechStore" <${process.env.EMAIL_USER}>`,
    to: "mcampo26@gmail.com", 
    subject: `🚀 Contacto: ${name}`,
    replyTo: email,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Mensaje de ${name}</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 10px;">
          ${message}
        </div>
      </div>
    `,
  });
};