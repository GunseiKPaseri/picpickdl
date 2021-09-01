import MaterialTable, {Action, Column} from 'material-table';
import React from 'react';
import {lighten} from '@material-ui/core/styles/colorManipulator';
import {useTheme} from '@material-ui/core';
import {CenterFocusWeak as CenterFocusWeakIcon} from '@material-ui/icons';
import {useDispatch, useSelector} from 'react-redux';
import {getSetSelectedItemAction, State} from '../redux';
import {PicObjWithBlob} from '../type';
import {selectElementCommand} from '../panel';


const ImgTable = ():JSX.Element => {
  const theme = useTheme();
  // Redux State
  const list = useSelector<State, PicObjWithBlob[]>((state) =>
    Object.keys(state.items).map((key)=>state.items[key]));
  const [columnObject] = React.useState<Column<PicObjWithBlob>[]>([
    {
      title: '画像',
      render: (rowData) =>
        <img src={rowData.uri} style={{maxWidth: 50, maxHeight: 50}} />,
      editable: 'never',
    },
    {
      title: 'URI',
      field: 'uri',
      render: (rowData)=><input type='url' value={rowData.uri} readOnly />,
      editable: 'never',
    },
    {
      title: 'ファイル名',
      field: 'filename',
      render: (rowData)=>
        (rowData.filename.length > 15 ?
          '...'+rowData.filename.slice(-15) : rowData.filename),
    },
    {title: 'リソース', field: 'treeinfo', editable: 'never',
      render: (rowData)=>
        (rowData.treeinfo.length > 30 ?
          '...'+rowData.treeinfo.slice(-30) : rowData.treeinfo)},
  ]);

  const actions: Action<PicObjWithBlob>[] = [
    {
      icon: () => <CenterFocusWeakIcon />,
      tooltip: '選択',
      onClick: (e, rowData)=>{
        if (Array.isArray(rowData)) {
          //
        } else {
          selectElementCommand(rowData.selector);
        }
      },
      position: 'row',
    },
  ];

  const dispatch = useDispatch();
  return (
    <MaterialTable options={{
      filtering: true,
      selection: true,
      showTitle: false,
      rowStyle: (rowData) => ({
        backgroundColor:
            rowData.tableData.checked ?
            lighten(theme.palette.secondary.light, 0.85) : '',
      }),
    }}
    onSelectionChange={(data) => dispatch(getSetSelectedItemAction(data))}
    columns={columnObject}
    data={list}
    actions={actions}/>
  );
};
export default ImgTable;
