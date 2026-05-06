export type EmailOptions = {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
};

export type EmailDriver = (options: EmailOptions) => Promise<void>;
