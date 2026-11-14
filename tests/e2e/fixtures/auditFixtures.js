/**
 * tests/e2e/fixtures/auditFixtures.js
 * Test fixtures for security testing, audit log query redaction, PII sanitization, and bulk import payloads.
 */

export const SENSITIVE_QUERY_STRINGS = [
  "?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret123&user=priya",
  "?apiKey=live_sec_9938812903810293&format=json",
  "?password=SuperSecretPassword123!&role=admin",
  "?jwt=abc.def.ghi&refresh_token=refresh-secret-1234",
  "?access_token=ya29.a0AfH6SMC...&otp=948201",
  "?credential=private_key_pem_here",
  "?secretKey=live_sk_test123",
];

export const SENSITIVE_BODY_PAYLOADS = [
  {
    username: "john_doe",
    password: "CleartextPassword99!",
    nested: {
      api_key: "api-key-value-1234",
      userToken: "token-abc-xyz",
    },
    tags: ["normal_tag", { access_token: "secret_access_token" }],
  },
  {
    phone: "9876543210",
    phone_enc: "enc:aes256gcm:somecipher",
    dob: "1995-08-15",
    dob_enc: "enc:aes256gcm:somecipher",
    email: "user@example.com",
    jwtToken: "bearer-token-here",
  },
];

export const VALID_BULK_IMPORT_PAYLOAD = {
  examSlug: "ssc-cgl",
  subjectName: "Quantitative Aptitude",
  questions: [
    {
      questionText: "What is the average of the first 10 prime numbers?",
      options: [
        { text: "12.9", isCorrect: true },
        { text: "15.4", isCorrect: false },
        { text: "11.8", isCorrect: false },
        { text: "13.2", isCorrect: false },
      ],
      explanation:
        "First 10 primes are 2, 3, 5, 7, 11, 13, 17, 19, 23, 29. Sum = 129. Average = 129 / 10 = 12.9.",
      difficulty: "easy",
    },
    {
      questionText:
        "If $x + \\frac{1}{x} = 3$, find the value of $x^3 + \\frac{1}{x^3}$.",
      options: [
        { text: "18", isCorrect: true },
        { text: "27", isCorrect: false },
        { text: "36", isCorrect: false },
        { text: "9", isCorrect: false },
      ],
      explanation:
        "$x^3 + \\frac{1}{x^3} = (x + \\frac{1}{x})^3 - 3(x + \\frac{1}{x}) = 3^3 - 3(3) = 27 - 9 = 18$.",
      difficulty: "medium",
    },
  ],
};
