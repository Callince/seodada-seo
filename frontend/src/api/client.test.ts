import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, apiErrorMessage } from "@/api/client";
import { useAuth } from "@/store/auth";
import type { User } from "@/types";

const user: User = {
  id: "u1",
  email: "t@test.com",
  full_name: "T",
  role: "owner",
  org_id: "o1",
  is_admin: false,
};

function unauthorized(config: AxiosRequestConfig): AxiosError {
  return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config as never, {}, {
    status: 401,
    statusText: "Unauthorized",
    data: {},
    headers: {},
    config: config as never,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAuth.setState({ accessToken: "old-access", refreshToken: "refresh-1", user });
});

describe("401 → silent refresh → retry", () => {
  it("refreshes once, retries with the new token, and stores it", async () => {
    vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { access_token: "new-access" } });
    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls++;
      if (calls === 1) throw unauthorized(config);
      return {
        data: { auth: config.headers?.Authorization },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const resp = await api.get("/whatever");
    expect(calls).toBe(2);
    expect(resp.data.auth).toBe("Bearer new-access");
    expect(useAuth.getState().accessToken).toBe("new-access");
  });

  it("logs out when the refresh call itself fails", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce(new Error("refresh down"));
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get("/whatever")).rejects.toThrow();
    expect(useAuth.getState().accessToken).toBeNull();
    expect(useAuth.getState().user).toBeNull();
  });

  it("does not loop on a second 401 after a successful refresh", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { access_token: "new-access" } });
    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls++;
      throw unauthorized(config); // every attempt 401s
    };

    await expect(api.get("/whatever")).rejects.toThrow();
    expect(calls).toBe(2); // original + exactly one retry
  });
});

describe("apiErrorMessage", () => {
  const respErr = (status: number, data: unknown) =>
    new AxiosError("Request failed with status code " + status, "ERR_BAD_RESPONSE", undefined, {}, {
      status,
      statusText: "",
      data,
      headers: {},
      config: {} as never,
    });
  /** No `response` at all — connection refused, offline, DNS, CORS. */
  const networkErr = (code = "ERR_NETWORK") =>
    new AxiosError("Network Error", code, undefined, {});

  it("prefers the API's own message: detail, then title", () => {
    expect(apiErrorMessage(respErr(400, { detail: "Bad keyword" }))).toBe("Bad keyword");
    expect(apiErrorMessage(respErr(500, { title: "Boom" }))).toBe("Boom");
    // Blank strings are not a message — fall through rather than render nothing.
    expect(apiErrorMessage(respErr(500, { detail: "   " }))).not.toBe("   ");
  });

  it("maps 402 to the budget message", () => {
    expect(apiErrorMessage(respErr(402, {}))).toBe("Monthly API budget exhausted.");
  });

  /** The regression this file previously asserted as CORRECT: with no
   *  problem+json body the helper returned axios's own string, so a stopped
   *  backend printed "Request failed with status code 502" under the login
   *  form. Developer text must never reach the user. */
  it("never leaks the raw axios message", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 502, 503, 504]) {
      const msg = apiErrorMessage(respErr(status, {}));
      expect(msg).not.toMatch(/status code|Request failed|Network Error|axios/i);
      expect(msg.length).toBeGreaterThan(10);
    }
    expect(apiErrorMessage(networkErr())).not.toMatch(/Network Error/);
  });

  it("says a gateway failure is temporary, not the user's fault", () => {
    for (const status of [502, 503, 504]) {
      expect(apiErrorMessage(respErr(status, {}))).toMatch(/temporarily unavailable/i);
    }
  });

  it("distinguishes unreachable from timed out", () => {
    expect(apiErrorMessage(networkErr())).toMatch(/can't reach the server/i);
    expect(apiErrorMessage(networkErr("ECONNABORTED"))).toMatch(/took too long/i);
  });

  it("gives 401 actionable sign-in copy and 429 a wait instruction", () => {
    expect(apiErrorMessage(respErr(401, {}))).toMatch(/email or password/i);
    expect(apiErrorMessage(respErr(429, {}))).toMatch(/wait a moment/i);
  });

  it("handles non-axios errors", () => {
    expect(apiErrorMessage(new Error("x"))).toBe("Something went wrong. Please try again.");
  });
});
