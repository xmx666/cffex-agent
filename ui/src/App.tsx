import React from 'react';
import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import { ConfigProvider as AppConfigProvider } from './contexts';
import router from './router';

// App 组件：应用的根组件，设置全局配置和路由
const App: GenieType.FC = React.memo(() => {
  return (
    <AppConfigProvider>
      <ConfigProvider locale={zhCN}>
        <RouterProvider router={router} />
      </ConfigProvider>
    </AppConfigProvider>
  );
});

export default App;
