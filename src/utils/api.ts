import type { CommonResponse } from '@inplayer-org/inplayer.js';

import type { InPlayerError } from '#types/inplayer';

export class ApiError extends Error {
  code: number;
  message: string;

  constructor(message = '', code: number) {
    super(message);
    this.name = 'ApiError';
    this.message = message;
    this.code = code;
  }
}

/**
 * Get data
 * @param response
 */
export const getDataOrThrow = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    const message = `Request '${response.url}' failed with ${response.status}`;
    const error = new ApiError(data?.message || message, response.status || 500);

    throw error;
  }

  return data;
};

export const getCommonResponseData = (response: { data: CommonResponse }) => {
  const { code, message } = response.data;
  if (code !== 200) {
    throw new Error(message);
  }
  return {
    errors: [],
    responseData: {
      message,
      code,
    },
  };
};

export const isCommonError = (error: unknown): error is InPlayerError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as InPlayerError).response?.data?.code === 'number' &&
    typeof (error as InPlayerError).response?.data?.message === 'string'
  );
};
