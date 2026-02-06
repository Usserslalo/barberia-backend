/**
 * Script temporal para registrar la plantilla auth_code_barberia_v2
 * en Meta WhatsApp Business API.
 *
 * Ejecutar una sola vez: npx ts-node scripts/create-whatsapp-template.ts
 *
 * Requiere en .env: WHATSAPP_TOKEN, WHATSAPP_WABA_ID
 */
import 'dotenv/config';
import axios, { AxiosError } from 'axios';

const version = process.env.WHATSAPP_API_VERSION || 'v22.0';
const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_WABA_ID;

const url = `https://graph.facebook.com/${version}/${wabaId}/message_templates`;

const body = {
  name: 'auth_code_barberia_v2',
  category: 'UTILITY',
  language: 'es',
  parameter_format: 'positional',
  components: [
    {
      type: 'body',
      text: '¡Hola! Tu código de acceso para Barbería App es: {{1}}. Úsalo para completar tu registro. Si no solicitaste este código, ignora este mensaje.',
      example: {
        body_text: [['123456']],
      },
    },
  ],
};

async function main() {
  if (!token || !wabaId) {
    console.error('❌ Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en .env');
    process.exit(1);
  }

  console.log('📤 Enviando POST a:', url);
  console.log('📋 Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Respuesta del servidor (status):', response.status);
    console.log('📥 Respuesta completa:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: unknown }>;
    console.error('❌ Error en la petición:');
    console.error('   Status:', axiosError.response?.status);
    console.error('   StatusText:', axiosError.response?.statusText);
    console.error('   response.data:', JSON.stringify(axiosError.response?.data, null, 2));
    console.error('   message:', axiosError.message);
    process.exit(1);
  }
}

main();
