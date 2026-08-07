# Launch decisions (Workstream 0)

Open product / ops decisions that gate live behaviour. Do not flip production
flags until the human has signed these off in writing.

| ID  | Topic                | Status | Notes                                                             |
| --- | -------------------- | ------ | ----------------------------------------------------------------- |
| §11 | Factor licensing     | Open   | Attribution text required on factors; confirm commercial licences |
| §11 | INR / Razorpay       | Open   | `BILLING_PROVIDER=razorpay` + keys + `CLEARESG_WS0_SIGNED_OFF=1`  |
| §11 | DPDP / Atlas region  | Open   | India data residency; retention purge live flag                   |
| §11 | Assurance disclaimer | Open   | Copy on auditor `/a/[token]` surfaces                             |
| §11 | Benchmark consent    | Open   | Cohort publish gate (`mayPublishBenchmarkCohorts`)                |

## Env gates (code)

| Flag                              | Effect                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| `CLEARESG_WS0_SIGNED_OFF=1`       | Allows live Stripe / Razorpay charge paths when keys are present |
| `CLEARESG_DEV_BYPASS=1`           | Local non-charging checkout stub only                            |
| `CLEARESG_RETENTION_PURGE_LIVE=1` | Enables live retention purge cron                                |

Without WS0 sign-off, paid checkout returns a structured denial pointing here.
