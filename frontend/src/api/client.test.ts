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
    new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, {}, {
      status,
      statusText: "",
      data,
      headers: {},
      config: {} as never,
    });

  it("prefers RFC 7807 detail", () => {
    expect(apiErrorMessage(respErr(400, { detail: "Bad keyword" }))).toBe("Bad keyword");
  });

  it("maps 402 to the budget message", () => {
    expect(apiErrorMessage(respErr(402, {}))).toBe("Monthly API budget exhausted.");
  });

  it("falls back to title, then message, then a generic string", () => {
    expect(apiErrorMessage(respErr(500, { title: "Boom" }))).toBe("Boom");
    expect(apiErrorMessage(respErr(500, {}))).toBe("Request failed");
    expect(apiErrorMessage(new Error("x"))).toBe("Something went wrong.");
  });
});
