// React fixture for the existing scanner / generator / vite-plugin tests.
// 现在 manifest-generator 在 vite-plugin 里跑 loader-inventory 对账,
// 这个文件是 data-table 组件的入口,缺失会被对账报错。
export default function DataTable() {
  return <div className="data-table">DataTable</div>;
}