import type { DataProvider } from "../types";
import { DemoProvider } from "./demo";
import { CloudBaseProvider } from "./cloudbase";
export const configError =
  import.meta.env.VITE_DATA_MODE === "cloudbase" &&
  !import.meta.env.VITE_CLOUDBASE_ENV_ID
    ? "CloudBase 模式缺少环境 ID，当前使用本地演示模式。"
    : "";
export const provider: DataProvider =
  import.meta.env.VITE_DATA_MODE === "cloudbase" &&
  import.meta.env.VITE_CLOUDBASE_ENV_ID
    ? new CloudBaseProvider()
    : new DemoProvider();
