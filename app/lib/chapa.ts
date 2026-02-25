interface ChapaInitParams {
  amount: number;
  currency: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customer: { email: string; name?: string };
}

export async function initializeChapaPayment(params: ChapaInitParams) {
  const CHAPA_API_URL = process.env.CHAPA_API_URL || 'https://api.chapa.co/v1/transaction/initialize';
  const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

  try {
    const response = await fetch(CHAPA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        currency: 'ETB', // Default for Chapa
        'customization[title]': 'Pharmacy Payment',
      }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error('Chapa API error:', error);
    return { success: false, error };
  }
}